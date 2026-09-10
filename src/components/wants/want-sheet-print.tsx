'use client'

import { useEffect, useState } from 'react'
import { Download, Printer, Share2 } from 'lucide-react'
import { CardArt } from '@/components/catalog/card-art'
import { Logotype, Symbol } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
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
 * vínculo com a fonte de preço sai com o código no lugar da arte.
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
 * ## Por que a imagem vem do TCGplayer, e não da Bandai
 *
 * Porque é a única que o navegador deixa exportar. Desenhar num `canvas` uma
 * imagem servida sem `Access-Control-Allow-Origin` **contamina** o canvas, e o
 * `toBlob` passa a falhar (decisão 058).
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
  const semArte = faltando.filter((want) => want.sheetImageUrl === null).length
  const folhas = Math.max(1, Math.ceil(faltando.length / CARDS_PER_SHEET))

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
            sheetImageUrl: want.sheetImageUrl,
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

  const compartilhavel = arquivos !== null && podeCompartilhar(arquivos)

  const compartilhar = async () => {
    if (!arquivos) return

    try {
      await navigator.share({
        files: arquivos,
        title: 'Procuro estas cartas',
        text: `Procuro ${faltando.length} ${faltando.length === 1 ? 'carta' : 'cartas'} · ${copias} ${copias === 1 ? 'cópia' : 'cópias'}`,
      })
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

          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden />
            Imprimir
          </Button>
        </div>

        {/*
          Uma folha, um botão, um toque. Um laço de downloads programáticos não
          sobrevive ao Safari — ver o comentário no topo do arquivo.

          Quem compartilha também ganha esses botões, discretos: guardar a imagem
          no aparelho é um caminho legítimo, e some da folha do sistema em alguns
          aplicativos.
        */}
        {!preparando && arquivos !== null && (arquivos.length > 1 || compartilhavel) ? (
          <div className="flex flex-wrap items-center gap-2">
            {arquivos.map((arquivo, indice) => (
              <Button
                key={arquivo.name}
                variant={compartilhavel ? 'ghost' : 'secondary'}
                onClick={() => baixarArquivo(arquivo)}
              >
                <Download className="size-4" aria-hidden />
                {arquivos.length === 1
                  ? 'Baixar imagem'
                  : `Baixar folha ${indice + 1} de ${arquivos.length}`}
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
          {semArte > 0
            ? `${semArte} ${semArte === 1 ? 'carta sai' : 'cartas saem'} com o código no lugar da arte; imprimindo, todas saem com a arte.`
            : 'Imprimindo, escolha “Salvar como PDF” no diálogo.'}
        </p>
      </div>

      <article className="relative overflow-hidden rounded-card border border-border bg-white p-6 text-black print:rounded-none print:border-0 print:p-0">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <Symbol
            label={null}
            className="absolute -top-[10%] -right-[22%] h-[120%] w-auto -rotate-12 opacity-[0.06]"
          />
        </div>

        <header className="relative mb-5 flex items-end justify-between gap-4 border-b border-black/10 pb-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight">Procuro estas cartas</h2>
            <p className="mt-1 text-sm text-black/60 tabular-nums">
              {faltando.length} {faltando.length === 1 ? 'carta' : 'cartas'} ·{' '}
              {copias} {copias === 1 ? 'cópia' : 'cópias'}
            </p>
          </div>
          <Logotype label="ColeXa" className="h-6 w-auto shrink-0 text-black" />
        </header>

        <ul className="relative grid grid-cols-3 gap-4 sm:grid-cols-4 print:grid-cols-4">
          {faltando.map((want) => (
            <li key={want.variantId} className="flex break-inside-avoid flex-col gap-1">
              <span className="relative block">
                <CardArt
                  src={want.imageUrl}
                  alt={`${want.cardCode} — ${want.cardName}`}
                  fallback={want.cardCode}
                  sizes="(max-width: 639px) 33vw, 25vw"
                />
                {/*
                  A quantidade é o dado que a folha existe para carregar: quem
                  olha precisa saber quantas, não só quais.
                */}
                <span className="absolute right-1 bottom-1 rounded-md bg-black px-1.5 py-0.5 text-xs font-bold text-white tabular-nums">
                  {want.remaining}x
                </span>
              </span>
              <span className="truncate text-[11px] font-semibold tabular-nums">
                {want.cardCode}
              </span>
              <span className="truncate text-[11px] text-black/60">{want.cardName}</span>
            </li>
          ))}
        </ul>

        <footer className="relative mt-6 border-t border-black/10 pt-3 text-[10px] text-black/50">
          Lista gerada no ColeXa · colexa.com.br
        </footer>
      </article>
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

function nomeDaFolha(indice: number, total: number): string {
  return total === 1
    ? 'want-list-colexa.jpg'
    : `want-list-colexa-${indice + 1}-de-${total}.jpg`
}

/**
 * Este aparelho compartilha **arquivos**?
 *
 * As três checagens são necessárias e diferentes. `share` sozinho existe em
 * navegadores que só mandam texto e link; `canShare` sem argumento responde
 * sobre a API, não sobre estes arquivos. Só `canShare({ files })` responde a
 * pergunta que importa, e ele precisa de `File` — com `Blob` devolve `false`
 * sem dizer por quê.
 */
function podeCompartilhar(arquivos: readonly File[]): boolean {
  if (arquivos.length === 0) return false
  if (typeof navigator === 'undefined') return false
  if (typeof navigator.share !== 'function') return false
  if (typeof navigator.canShare !== 'function') return false

  try {
    return navigator.canShare({ files: [...arquivos] })
  } catch {
    return false
  }
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
