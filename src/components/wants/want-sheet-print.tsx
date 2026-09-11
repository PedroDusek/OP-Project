'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Printer, Share2 } from 'lucide-react'
import { CardArt } from '@/components/catalog/card-art'
import { Logotype, Symbol } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { catalogImageForCanvas } from '@/lib/catalog-image'
import { CARDS_PER_SHEET, renderWantSheets } from '@/lib/want-sheet-image'
import type { WantView } from '@/server/application/wants'

/**
 * A want list em folha, para mandar no grupo ou virar PDF.
 *
 * ## Três saídas, e elas servem a coisas diferentes
 *
 * **Compartilhar** é o caminho normal no celular: uma folha do sistema, todas as
 * imagens de uma vez, e elas vão direto para o grupo do WhatsApp ou para onde a
 * pessoa escolher. É o propósito para o qual a folha em imagem existe.
 *
 * **Baixar** é o mesmo arquivo para quem não tem compartilhamento — computador,
 * quase sempre. Um botão por folha, e a razão está abaixo.
 *
 * **Imprimir** continua, e não é redundância: a folha impressa usa as imagens do
 * catálogo, que existem para **todas** as cartas. Na imagem, quem ainda não tem
 * vínculo com a fonte de preço sai com a imagem do catálogo, que traz a marca
 * "SAMPLE" (decisão 067).
 *
 * ## Por que as folhas são preparadas quando a tela abre
 *
 * Porque `navigator.share` exige a **ativação do toque**, e essa ativação não
 * sobrevive ao desenho: montar as folhas carrega uma imagem por carta da rede, e
 * quando isso termina o Safari já considera o toque gasto — o compartilhamento
 * seria recusado com `NotAllowedError`.
 *
 * Preparando antes, o toque só compartilha, e a folha do sistema abre na hora.
 * O botão fica desabilitado enquanto não há o que mandar, porque um botão que
 * aceita o toque e não faz nada é pior que um botão que diz que está esperando.
 *
 * ## Por que um botão por folha, e não um laço de downloads
 *
 * Isto foi um defeito relatado num iPhone de verdade: baixando várias, só a
 * última chegava. No Safari um download programático é na prática uma
 * **navegação** para o `blob:`, e a navegação seguinte cancela a anterior que
 * ainda não terminou. As notificações de todas apareciam, o que fazia parecer
 * que tinha funcionado.
 *
 * Aumentar o intervalo entre os cliques seria chutar um número que depende do
 * tamanho do arquivo e da velocidade do aparelho. Um toque por arquivo não
 * depende de número nenhum.
 *
 * ## De onde vem a imagem de cada carta
 *
 * Do TCGplayer quando a carta tem vínculo com a fonte de preço, porque ela é
 * limpa (decisão 058). Quando não tem, da Bandai **pelo nosso domínio**, pelo
 * otimizador: pedida direto, a imagem da Bandai contamina o `canvas` e o `toBlob`
 * falha; pelo mesmo domínio, não (decisão 067). Ela traz a marca "SAMPLE", e por
 * isso é o que sobra, e não a primeira escolha. Ver `lib/catalog-image.ts`.
 *
 * ## O que a folha carrega da marca
 *
 * Logotipo no topo e o X apagado ao fundo. É divulgação, e é o tipo de ornamento
 * que a seção 19 da especificação permite — forma própria da marca, nunca arte
 * de franquia.
 */
export function WantSheetPrint({ wants }: { wants: WantView[] }) {
  const { toast } = useToast()

  const faltando = wants.filter((want) => want.status !== 'satisfied')
  const copias = faltando.reduce((total, want) => total + want.remaining, 0)
  /*
   * Duas contas, porque sao dois avisos diferentes. Sem vinculo mas com imagem
   * no catalogo, a carta sai com a arte da Bandai e a marca "SAMPLE"; sem nenhuma
   * das duas, sai com o codigo escrito no lugar. Hoje toda variante tem imagem
   * no catalogo — medido —, mas o aviso nao pode prometer isso.
   */
  const comAmostra = faltando.filter(
    (want) => want.sheetImageUrl === null && want.imageUrl !== null,
  ).length
  const semArte = faltando.filter(
    (want) => want.sheetImageUrl === null && want.imageUrl === null,
  ).length
  const folhasDeDoze = emFolhas(faltando)
  const folhas = Math.max(1, folhasDeDoze.length)

  /*
   * A assinatura da lista, e nao a lista: `faltando` e um array novo a cada
   * renderizacao, e usa-lo como dependencia redesenharia as folhas para sempre.
   */
  const assinatura = faltando.map((want) => `${want.variantId}:${want.remaining}`).join(',')

  /*
   * Um estado so, carregando a assinatura de que ele fala. "Preparando" e
   * "falhou" sao **derivados** dele, e nao bandeiras separadas: com bandeiras,
   * mudar a lista pediria tres escritas de estado em ordem certa, e uma delas
   * fora de ordem mostraria as folhas antigas como se fossem as novas.
   *
   * `arquivos: null` com a assinatura preenchida quer dizer que o desenho falhou
   * neste aparelho — diferente de `preparo: null`, que quer dizer que ainda nao
   * tentamos.
   */
  const [preparo, setPreparo] = useState<{ assinatura: string; arquivos: File[] | null } | null>(
    null,
  )

  const folhaRef = useRef<HTMLDivElement>(null)
  const [imprimindo, setImprimindo] = useState(false)

  const pronto = preparo !== null && preparo.assinatura === assinatura
  const preparando = faltando.length > 0 && !pronto
  const arquivos = pronto ? preparo.arquivos : null
  const falhou = pronto && preparo.arquivos === null

  useEffect(() => {
    if (faltando.length === 0) return

    let cancelado = false

    void (async () => {
      try {
        const imagens = await renderWantSheets(
          faltando.map((want) => ({
            cardCode: want.cardCode,
            cardName: want.cardName,
            sheetImageUrl: want.sheetImageUrl ?? catalogImageForCanvas(want.imageUrl),
            remaining: want.remaining,
          })),
        )
        if (!cancelado) {
          setPreparo({
            assinatura,
            arquivos: imagens.map(
              (blob, indice) =>
                new File([blob], nomeDaFolha(indice, imagens.length), { type: 'image/jpeg' }),
            ),
          })
        }
      } catch {
        /*
         * Falhar aqui nao tira a tela do ar: imprimir continua, e imprimindo
         * todas as cartas saem com arte. O aviso e discreto de proposito — nao e
         * um erro do qual a pessoa precise se defender.
         */
        if (!cancelado) setPreparo({ assinatura, arquivos: null })
      }
    })()

    return () => {
      cancelado = true
    }
    // `assinatura` resume `faltando`; ver o comentario acima.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura])

  /*
   * `null` quando da para compartilhar. Quando nao da, diz **por que** — a tela
   * cair em silencio nos downloads fazia o caminho principal parecer nao existir,
   * e o motivo mais comum nem e do navegador: e o endereco.
   */
  const legenda = `Procuro ${faltando.length} ${faltando.length === 1 ? 'carta' : 'cartas'} · ${copias} ${copias === 1 ? 'cópia' : 'cópias'}`

  const carga = arquivos === null ? null : cargaParaCompartilhar(arquivos, legenda)
  const semCompartilhar = carga === null ? 'sem-suporte' : carga.ok ? null : carga.motivo
  const compartilhavel = carga !== null && carga.ok

  const compartilhar = async () => {
    if (carga === null || !carga.ok) return

    try {
      // O pacote enviado e **exatamente** o que `canShare` aprovou. Montar um
      // aqui e conferir outro ali e como o iOS recusa sem dizer por que.
      await navigator.share(carga.dados)
    } catch (error) {
      // Fechar a folha do sistema nao e erro: e a pessoa desistindo, e um aviso
      // aqui transformaria uma escolha dela num problema.
      if (error instanceof Error && error.name === 'AbortError') return

      toast({
        title: 'Não foi possível compartilhar',
        description: 'Baixe a imagem ou imprima a folha.',
        tone: 'error',
      })
    }
  }

  /**
   * Espera a arte chegar e so entao chama a impressao.
   *
   * `window.print()` dispara na hora, e imagem a caminho nao entra no papel:
   * era isso que mandava para o PDF paginas inteiras sem arte. Carregar cedo
   * (`eager`) resolve metade — a outra metade e nao imprimir antes de terminar.
   */
  const imprimir = async () => {
    setImprimindo(true)
    try {
      await imagensProntas(folhaRef.current)
    } finally {
      setImprimindo(false)
    }
    window.print()
  }

  if (faltando.length === 0) {
    return (
      <EmptyState
        title="Nada faltando"
        description="Quando houver carta na sua want list que você ainda não tem, ela aparece aqui pronta para imprimir."
        action={{ label: 'Adicionar cartas', href: '/quero/adicionar' }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/*
        Some na impressão: um botão "imprimir" impresso na folha é ruído, e é o
        primeiro sinal de que a folha foi feita para a tela e não para o papel.
      */}
      <div className="flex flex-col gap-2 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {/*
            Enquanto prepara, o botão principal existe e diz que está esperando.
            Sumir e reaparecer moveria o resto da tela debaixo do polegar.
          */}
          {preparando ? (
            <Button disabled loading>
              Preparando
            </Button>
          ) : compartilhavel && arquivos !== null ? (
            <Button onClick={() => void compartilhar()}>
              <Share2 className="size-4" aria-hidden />
              {/*
                O rótulo conta as folhas que existem, e não as que a contagem de
                cartas previa. Enquanto prepara, `folhas` é a melhor estimativa;
                depois, quem manda é o que vai de fato ser enviado.
              */}
              Compartilhar {arquivos.length > 1 ? `as ${arquivos.length} imagens` : 'a imagem'}
            </Button>
          ) : arquivos !== null && arquivos.length === 1 ? (
            <Button onClick={() => baixarArquivo(arquivos[0])}>
              <Download className="size-4" aria-hidden />
              Baixar imagem
            </Button>
          ) : null}

          <Button variant="secondary" loading={imprimindo} onClick={() => void imprimir()}>
            <Printer className="size-4" aria-hidden />
            Imprimir
          </Button>
        </div>

        {/*
          Baixar folha a folha e **so** onde nao ha compartilhamento de arquivo —
          computador, quase sempre. Onde ha, um clique resolve, e oferecer os dois
          caminhos lado a lado fazia o principal parecer o secundario.

          Um botao por folha, nunca um laco: no Safari um download programatico e
          uma navegacao para o `blob:`, e a seguinte cancela a anterior que ainda
          nao terminou. Foi esse o defeito.
        */}
        {!preparando && arquivos !== null && semCompartilhar !== null ? (
          <p className="text-sm text-text-muted">
            {semCompartilhar === 'inseguro'
              ? 'Mandar direto para outro aplicativo precisa de HTTPS, e este endereço não é. Em colexa.com.br o botão de compartilhar aparece aqui.'
              : 'Este navegador não manda arquivo para outro aplicativo. Baixe as folhas e mande do jeito que preferir.'}
          </p>
        ) : null}

        {!preparando && !compartilhavel && arquivos !== null && arquivos.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            {arquivos.map((arquivo, indice) => (
              <Button key={arquivo.name} variant="secondary" onClick={() => baixarArquivo(arquivo)}>
                <Download className="size-4" aria-hidden />
                Baixar folha {indice + 1} de {arquivos.length}
              </Button>
            ))}
          </div>
        ) : null}

        <p className="text-sm text-text-muted">
          {explicacao({
            falhou,
            preparando,
            compartilhavel,
            folhas: arquivos?.length ?? folhas,
          })}{' '}
          {avisoDeArte({ comAmostra, semArte })}
        </p>
      </div>

      {/*
        Uma folha por bloco de doze, e nao uma grade unica com tudo dentro.

        A grade unica era o defeito: `break-inside: avoid` num item de grade nao
        e respeitado de forma confiavel, e o navegador fatia a **linha** da grade
        na borda da pagina. Cortava a arte no meio, e so aparecia a partir da
        terceira folha, quando o acumulo faz a linha cair em cima da borda.

        Cada folha e um bloco que termina em quebra de pagina, entao a conta e a
        mesma da imagem e da mesma constante: doze cabem, doze vao. Nao ha numero
        de paginas presumido em lugar nenhum — ele sai da divisao.

        Na tela isso tambem e melhor: a pessoa ve exatamente o que sai em cada
        folha, do mesmo jeito que sai em cada imagem.
      */}
      <div ref={folhaRef} className="flex flex-col gap-4">
      {folhasDeDoze.map((folha, indice) => (
        <article
          key={indice}
          className="relative overflow-hidden rounded-card border border-border bg-white p-6 text-black print:break-inside-avoid print:rounded-none print:border-0 print:p-0 print:not-last:break-after-page"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <Symbol
              label={null}
              className="absolute -top-[10%] -right-[22%] h-[120%] w-auto -rotate-12 opacity-[0.06]"
            />
          </div>

          <header className="relative mb-5 flex items-end justify-between gap-4 border-b border-black/10 pb-4 print:mb-3 print:pb-2">
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight">Procuro estas cartas</h2>
              <p className="mt-1 text-sm text-black/60 tabular-nums">
                {faltando.length} {faltando.length === 1 ? 'carta' : 'cartas'} ·{' '}
                {copias} {copias === 1 ? 'cópia' : 'cópias'}
                {/*
                  Quem recebe a terceira folha precisa saber que ha uma primeira e
                  uma segunda, senao le uma lista truncada como se fosse inteira.
                */}
                {folhasDeDoze.length > 1
                  ? ` · folha ${indice + 1} de ${folhasDeDoze.length}`
                  : ''}
              </p>
            </div>
            <Logotype label="ColeXa" className="h-6 w-auto shrink-0 text-black" />
          </header>

          <ul className="relative grid grid-cols-3 gap-4 sm:grid-cols-4 print:grid-cols-4">
            {folha.map((want) => (
              <li key={want.variantId} className="flex break-inside-avoid flex-col gap-1">
                <span className="relative block">
                  {/*
                    `eager`: sem isto, o que nunca passou pela tela nunca e
                    buscado, e a folha 2 em diante sai em branco no PDF.
                  */}
                  <CardArt
                    src={want.imageUrl}
                    alt={`${want.cardCode} — ${want.cardName}`}
                    fallback={want.cardCode}
                    sizes="(max-width: 639px) 33vw, 25vw"
                    eager
                  />
                  {/*
                    A quantidade é o dado que a folha existe para carregar: quem
                    olha precisa saber quantas, não só quais.
                  */}
                  <span className="absolute right-1 bottom-1 rounded-md bg-black px-1.5 py-0.5 text-xs font-bold text-white tabular-nums">
                    {want.remaining}x
                  </span>
                </span>
                <span className="truncate text-[11px] font-semibold tabular-nums print:text-[10px]">
                  {want.cardCode}
                </span>
                <span className="truncate text-[11px] text-black/60 print:text-[10px]">{want.cardName}</span>
              </li>
            ))}
          </ul>

          <footer className="relative mt-6 border-t border-black/10 pt-3 text-[10px] text-black/50 print:mt-3 print:pt-2">
            Lista gerada no ColeXa · colexa.com.br
          </footer>
        </article>
      ))}
      </div>
    </div>
  )
}

/**
 * A frase que explica o que vai acontecer, para o estado em que a tela está.
 *
 * Fora do JSX porque são quatro estados, e quatro ternários aninhados no meio de
 * um parágrafo escondem qual deles está faltando.
 */
function explicacao({
  falhou,
  preparando,
  compartilhavel,
  folhas,
}: {
  falhou: boolean
  preparando: boolean
  compartilhavel: boolean
  folhas: number
}): string {
  const quantas = folhas > 1 ? `${folhas} imagens` : 'uma imagem'
  const cada = `de até ${CARDS_PER_SHEET} cartas cada`

  if (falhou) {
    return 'Não foi possível preparar as imagens neste aparelho. A impressão continua funcionando, e nela todas as cartas saem com a arte.'
  }
  if (preparando) {
    return `Preparando ${quantas}, ${cada}.`
  }
  if (compartilhavel) {
    return folhas > 1
      ? `Vão ${quantas}, ${cada} — as ${folhas} de uma vez, no grupo que você escolher.`
      : `Vai ${quantas}, ${cada}, para o grupo que você escolher.`
  }
  return folhas > 1
    ? `São ${quantas}, ${cada}. Baixe uma por vez.`
    : 'A imagem baixa direto.'
}

/**
 * A lista em folhas de doze — a mesma conta da imagem, da mesma constante.
 *
 * O numero de folhas nunca e presumido: ele sai da divisao. Uma lista de uma
 * carta da uma folha, e uma de cem da nove.
 */
/**
 * Resolve quando toda arte da folha estiver desenhada.
 *
 * Erro de carregamento tambem resolve: uma carta que nao veio sai com o codigo
 * no lugar da arte, e travar a impressao inteira por causa dela seria trocar uma
 * folha imperfeita por nenhuma folha.
 */
async function imagensProntas(raiz: HTMLElement | null): Promise<void> {
  if (!raiz) return

  const imagens = [...raiz.querySelectorAll('img')]

  await Promise.all(
    imagens.map(async (img) => {
      try {
        // `decode` espera o desenho, e nao so o download — que e a diferenca
        // entre a imagem existir e a imagem aparecer no papel.
        await img.decode()
      } catch {
        // Falhou ou nao ha o que decodificar. Segue.
      }
    }),
  )
}

function emFolhas(wants: readonly WantView[]): WantView[][] {
  const folhas: WantView[][] = []
  for (let i = 0; i < wants.length; i += CARDS_PER_SHEET) {
    folhas.push(wants.slice(i, i + CARDS_PER_SHEET))
  }
  return folhas
}

/**
 * O que a pessoa precisa saber sobre a arte da imagem, antes de mandar no grupo.
 *
 * A marca "SAMPLE" é dita em voz alta: quem manda a lista no grupo vai ver a marca
 * nas cartas, e descobrir depois de enviar é pior do que saber antes.
 */
function avisoDeArte({ comAmostra, semArte }: { comAmostra: number; semArte: number }): string {
  const partes: string[] = []
  if (comAmostra > 0) {
    partes.push(
      `${comAmostra} ${comAmostra === 1 ? 'carta sai' : 'cartas saem'} com a imagem do catálogo, que traz a marca SAMPLE.`,
    )
  }
  if (semArte > 0) {
    partes.push(
      `${semArte} ${semArte === 1 ? 'carta sai' : 'cartas saem'} com o código no lugar da arte; imprimindo, todas saem com a arte.`,
    )
  }
  return partes.length > 0 ? partes.join(' ') : 'Imprimindo, escolha “Salvar como PDF” no diálogo.'
}

function nomeDaFolha(indice: number, total: number): string {
  return total === 1
    ? 'want-list-colexa.jpg'
    : `want-list-colexa-${indice + 1}-de-${total}.jpg`
}

/**
 * O pacote que este aparelho aceita compartilhar, ou o motivo de não aceitar.
 *
 * ## O motivo mais comum não é o navegador, é o endereço
 *
 * `navigator.share` só existe em **contexto seguro**. Aberto pelo IP da rede
 * local em `http://`, como se testa no celular durante o desenvolvimento, a API
 * simplesmente não está lá — e o mesmo aparelho, no mesmo navegador,
 * compartilha sem problema em `https://`. Ver a armadilha 48 no handoff.
 *
 * ## Por que dois pacotes, e não um
 *
 * O iOS recusa `files` junto de `text` em várias versões: `canShare` devolve
 * `false` para o pacote inteiro, e o botão sumiria mesmo num aparelho que
 * compartilha imagem sem dificuldade nenhuma.
 *
 * Então pergunta-se pelo pacote completo e, se ele não passar, pelos arquivos
 * sozinhos. A legenda é enfeite; as imagens são o assunto, e perder a legenda é
 * muito melhor que perder o botão.
 *
 * O que for aprovado é o que vai ser enviado — conferir um pacote e mandar
 * outro é a forma mais direta de o iOS recusar sem dizer por quê.
 *
 * ## As checagens, e por que são separadas
 *
 * `share` sozinho existe em navegadores que só mandam texto e link; `canShare`
 * sem argumento responde sobre a API, não sobre estes arquivos. Só
 * `canShare({ files })` responde a pergunta que importa, e ele precisa de
 * `File` — com `Blob` devolve `false` sem dizer por quê.
 */
type CargaDeCompartilhamento =
  | { ok: true; dados: ShareData }
  | { ok: false; motivo: 'inseguro' | 'sem-suporte' }

function cargaParaCompartilhar(
  arquivos: readonly File[],
  legenda: string,
): CargaDeCompartilhamento {
  if (arquivos.length === 0) return { ok: false, motivo: 'sem-suporte' }
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { ok: false, motivo: 'sem-suporte' }
  }

  if (window.isSecureContext === false) return { ok: false, motivo: 'inseguro' }

  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
    return { ok: false, motivo: 'sem-suporte' }
  }

  const files = [...arquivos]
  const candidatos: ShareData[] = [
    { files, title: 'Procuro estas cartas', text: legenda },
    { files },
  ]

  for (const dados of candidatos) {
    try {
      if (navigator.canShare(dados)) return { ok: true, dados }
    } catch {
      // Pacote recusado por este navegador. Tenta o proximo.
    }
  }

  return { ok: false, motivo: 'sem-suporte' }
}

/**
 * Entrega um arquivo. **Um**, e sempre a partir de um toque.
 *
 * O `<a>` entra no documento antes do clique e sai depois: o Safari ignora o
 * clique num elemento que nunca esteve na árvore.
 *
 * O endereço não é revogado aqui. `click()` só **inicia** o download; revogar na
 * linha seguinte derruba o endereço antes de o navegador ler os bytes, e o
 * arquivo sai vazio ou nem sai. O minuto é folga larga de propósito.
 */
function baixarArquivo(arquivo: File): void {
  const url = URL.createObjectURL(arquivo)
  const link = document.createElement('a')

  link.href = url
  link.download = arquivo.name
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()

  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
