'use client'

import { useEffect, useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { catalogImageForCanvas } from '@/lib/catalog-image'
import { baixarArquivo, cargaParaCompartilhar, nomeDeArquivo } from '@/lib/compartilhar'
import { renderDeckSheet, type DeckSheet } from '@/lib/deck-sheet-image'
import { SITE_URL } from '@/lib/indexacao'
import { storedImageFromOrigin } from '@/server/domain/catalog/stored-image'
import { carregarDeckAction } from '@/app/(app)/deck/actions'

/**
 * Compartilhar uma decklist como imagem (pedido do dono do produto em 23/11).
 *
 * Irmão do compartilhar da want list, e de propósito: é a mesma gestualidade —
 * uma imagem, a folha do sistema no celular, o download onde não há folha.
 *
 * ## Por que um painel, e não compartilhar direto no toque
 *
 * `navigator.share` exige a **ativação do toque**, e ela não sobrevive ao
 * trabalho: aqui o toque teria de buscar as cinquenta cartas no servidor e
 * carregar uma imagem por carta antes de desenhar. Quando isso terminasse, o
 * Safari já consideraria o toque gasto, e o compartilhamento voltaria com
 * `NotAllowedError`.
 *
 * A want list resolve isso preparando a folha quando a tela abre. Aqui não dá:
 * a tela é uma **lista** de decklists, e preparar todas seria baixar centenas
 * de artes para compartilhar, quase sempre, nenhuma.
 *
 * Então o toque abre o painel, o painel prepara, e o segundo toque — já com a
 * imagem pronta — compartilha. Dois toques, e o segundo é instantâneo.
 *
 * ## O botão é Premium, como abrir
 *
 * Decisão do dono do produto em 23/11. Quem não assina já não abre a lista, e
 * compartilhar é usá-la; o `readDeck` recusa do lado do servidor de qualquer
 * jeito, e esconder o botão evita o toque que terminaria em recusa. Excluir
 * continua de todos, e por isso continua ao lado.
 */
export function ShareDeck({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/*
        `md` e não `sm`: 44 px de alvo de toque, como o excluir ao lado. O `sm`
        existe para linha de lista no desktop, e este produto é mobile-first.
      */}
      <Button
        variant="secondary"
        size="md"
        className="shrink-0 px-3"
        onClick={() => setOpen(true)}
        aria-label={`Compartilhar ${name}`}
      >
        <Share2 className="size-4" aria-hidden />
      </Button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Compartilhar a decklist"
        description={name}
      >
        {/*
          Montado só quando abre, e desmontado ao fechar: é o que faz a imagem
          ser preparada no momento em que alguém quis, e não antes.
        */}
        {open ? <Preparo id={id} name={name} /> : null}
      </Sheet>
    </>
  )
}

type Estado =
  | { status: 'preparando' }
  | { status: 'pronto'; arquivo: File; url: string }
  | { status: 'erro'; message: string }

function Preparo({ id, name }: { id: string; name: string }) {
  const [estado, setEstado] = useState<Estado>({ status: 'preparando' })
  const { toast } = useToast()

  useEffect(() => {
    let cancelado = false
    let urlCriada: string | null = null

    void (async () => {
      const resposta = await carregarDeckAction(id)
      if (cancelado) return

      if (resposta.status === 'error') {
        setEstado({ status: 'erro', message: resposta.message })
        return
      }

      try {
        const blob = await renderDeckSheet(paraFolha(resposta.deck))
        if (cancelado) return

        const arquivo = new File([blob], nomeDeArquivo(name, 'decklist'), { type: 'image/jpeg' })
        urlCriada = URL.createObjectURL(arquivo)
        setEstado({ status: 'pronto', arquivo, url: urlCriada })
      } catch {
        if (!cancelado) {
          setEstado({
            status: 'erro',
            message: 'Não foi possível preparar a imagem neste navegador.',
          })
        }
      }
    })()

    return () => {
      cancelado = true
      // A previa some com o painel; o arquivo baixado nao depende mais dela.
      if (urlCriada) URL.revokeObjectURL(urlCriada)
    }
  }, [id, name])

  if (estado.status === 'erro') {
    return (
      <p role="alert" className="text-sm text-danger">
        {estado.message}
      </p>
    )
  }

  if (estado.status === 'preparando') {
    return (
      <div className="flex flex-col gap-3">
        <div className="aspect-[1240/2200] w-full animate-pulse rounded-card bg-surface-muted" />
        <p role="status" className="text-sm text-text-muted">
          Montando a imagem da lista…
        </p>
      </div>
    )
  }

  return <Pronto arquivo={estado.arquivo} url={estado.url} name={name} toast={toast} />
}

function Pronto({
  arquivo,
  url,
  name,
  toast,
}: {
  arquivo: File
  url: string
  name: string
  toast: ReturnType<typeof useToast>['toast']
}) {
  /*
   * O texto que viaja junto é o **endereço do site**, e não um resumo da lista
   * — o mesmo que a folha da want list leva, e pelo mesmo motivo: a imagem já
   * diz o que é, e esse é o único campo de texto que chega ao grupo.
   */
  const carga = cargaParaCompartilhar([arquivo], `Decklist ${name}`, SITE_URL)
  const compartilhavel = carga.ok

  const compartilhar = async () => {
    if (!carga.ok) return

    try {
      // O pacote enviado e **exatamente** o que `canShare` aprovou.
      await navigator.share(carga.dados)
    } catch (error) {
      // Fechar a folha do sistema nao e erro: e a pessoa desistindo.
      if (error instanceof Error && error.name === 'AbortError') return

      toast({
        title: 'Não foi possível compartilhar',
        description: 'Baixe a imagem e mande do jeito que preferir.',
        tone: 'error',
      })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/*
        A prévia é a própria imagem que vai ser enviada, e não um desenho
        parecido: é o que deixa conferir antes de mandar ao grupo. `img` cru de
        propósito — a origem é um `blob:` deste navegador, e o otimizador do
        Next não serve isso.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Prévia da imagem da decklist ${name}`}
        className="w-full rounded-card border border-border"
      />

      <div className="flex flex-col gap-2">
        {compartilhavel ? (
          <Button block size="lg" onClick={() => void compartilhar()}>
            <Share2 className="size-4" aria-hidden />
            Compartilhar
          </Button>
        ) : null}

        <Button
          variant={compartilhavel ? 'secondary' : 'primary'}
          block
          size="lg"
          onClick={() => baixarArquivo(arquivo)}
        >
          <Download className="size-4" aria-hidden />
          Baixar a imagem
        </Button>

        {!compartilhavel && carga.motivo === 'inseguro' ? (
          <p className="text-xs text-text-muted">
            Mandar direto para outro aplicativo precisa de HTTPS, e este endereço não é. Em
            colexa.com.br o botão de compartilhar aparece aqui.
          </p>
        ) : null}
      </div>
    </div>
  )
}

/**
 * A lista como a folha a quer.
 *
 * A arte preferida é a da **fonte de preço**, porque costuma ser limpa (decisão
 * 058): a nossa traz a marca "SAMPLE" atravessada, e numa folha inteira isso
 * vira trinta "SAMPLE" — era assim que a primeira versão desta folha saía,
 * conferida no navegador em 23/11.
 *
 * Nem sempre resolve, e isso não é defeito nosso: na mesma conferência, parte
 * das artes da fonte também veio com "SAMPLE", e a OP-18 inteira veio, por ser
 * coleção nova. A folha usa a melhor que existe.
 *
 * Sem vínculo, vale a **nossa** arte guardada (decisão 113): mesmo domínio,
 * então não contamina o `canvas`, e já vem convertida — não paga o otimizador
 * de novo. O caminho pelo otimizador fica de terceira, para endereço que não
 * reconhecemos. Carta nenhuma some da folha por falta de imagem.
 */
function paraFolha(deck: {
  name: string
  leader: {
    cardCode: string
    cardName: string
    type: string
    cost: number | null
    imageUrl: string | null
    sheetImageUrl: string | null
    colors: string[]
  }
  lines: {
    cardCode: string
    cardName: string
    type: string
    cost: number | null
    imageUrl: string | null
    sheetImageUrl: string | null
    copies: number
  }[]
}): DeckSheet {
  const arte = (carta: { sheetImageUrl: string | null; imageUrl: string | null }) =>
    carta.sheetImageUrl ?? storedImageFromOrigin(carta.imageUrl) ?? catalogImageForCanvas(carta.imageUrl)

  return {
    name: deck.name,
    leader: {
      cardCode: deck.leader.cardCode,
      cardName: deck.leader.cardName,
      type: deck.leader.type,
      cost: deck.leader.cost,
      copies: 1,
      sheetImageUrl: arte(deck.leader),
      colors: deck.leader.colors,
    },
    cards: deck.lines.map((linha) => ({
      cardCode: linha.cardCode,
      cardName: linha.cardName,
      type: linha.type,
      cost: linha.cost,
      copies: linha.copies,
      sheetImageUrl: arte(linha),
    })),
  }
}
