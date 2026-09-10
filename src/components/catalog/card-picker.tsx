'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Loader2, Minus, Plus, SearchX } from 'lucide-react'
import { CardArt } from '@/components/catalog/card-art'
import { CatalogFilters } from '@/components/catalog/catalog-filters'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SearchBar } from '@/components/ui/search-bar'
import { EmptyState } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import {
  countActiveFilters,
  toApiQuery,
  toCatalogQuery,
  type CatalogSearchParams,
  PARAM,
} from '@/lib/catalog-params'
import type { CatalogVocabulary } from '@/server/application/catalog/vocabulary'
import { cn } from '@/lib/cn'

/**
 * Escolher várias cartas do catálogo de uma vez, com um contador em cada uma.
 *
 * O gesto das telas 25 a 28, e o mesmo que a want list precisa: percorrer o
 * catálogo com filtros e ir marcando quantas de cada. Quem decide o que fazer
 * com a leva é quem usa — este componente só junta a escolha e a entrega a uma
 * ação de servidor.
 *
 * Nasceu dentro de `bulk-add` e saiu de lá quando a want list pediu o mesmo. A
 * alternativa era copiar 400 linhas, e com elas duas cópias de decisões sutis
 * — a corrida entre buscas, o ajuste durante a renderização, o formulário
 * nativo escondido — que só se lembraria de consertar num lugar.
 *
 * ## A primeira leva vem do servidor
 *
 * A tela abria vazia e buscava ao montar. Se o JavaScript não subisse — e num
 * navegador antigo ele pode não subir —, ela ficava girando para sempre, sem
 * nada na tela e sem dizer por quê. Agora a primeira leva chega pronta do
 * servidor, como no catálogo, e o cliente só busca quando o filtro muda.
 *
 * ## Por que os filtros não vão para a URL
 *
 * No catálogo eles vão, porque lá a lista filtrada é um endereço. Aqui são
 * passo de uma tarefa: navegar a cada filtro remontaria a grade e apagaria as
 * cartas já escolhidas. Então o estado é local, e a busca vai pela API — a
 * mesma que cobra a cota de leitura do catálogo (decisão 020).
 *
 * ## O contador começa em zero
 *
 * Não mostra "atual: 3 → 4" como a tela 27: aqui só se acrescenta, e o número
 * é quantas cópias entram. Reduzir o que já se tem continua sendo carta a
 * carta, onde a decisão 007 pode pedir de onde as cópias saem — pergunta que
 * não cabe numa leva de cinquenta.
 */

export interface Card {
  variantId: string
  cardCode: string
  cardName: string
  rarity: string | null
  variantType: string
  imageUrl: string | null
}

interface ApiPage {
  items: {
    variantId: string
    cardCode: string
    cardName: string
    rarity: string | null
    variantType: string
    imageUrl: string | null
  }[]
  total: number
  pageSize: number
}

const PAGE_SIZE = 24

/** O estado que uma acao de leva devolve. As duas hoje tem esta forma. */
export type PickerState =
  | { status: 'idle' }
  | { status: 'added'; cards: number; copies: number }
  | { status: 'error'; message: string }

export const PICKER_IDLE: PickerState = { status: 'idle' }

export interface PickerCopy {
  /** Onde a leva vai parar: "Binder Principal", "sua want list". */
  destination: string
  /** O titulo da confirmacao, ja com a contagem. */
  confirmTitle: (copies: number) => string
  confirmDescription: (cards: number, copies: number) => string
  /** A descricao do aviso de sucesso. O titulo e sempre a contagem de copias. */
  successDescription: (cards: number) => string
}

export function CardPicker({
  action,
  hiddenFields = {},
  copy,
  vocabulary,
  initialCards,
  initialTotal,
}: {
  action: (previous: PickerState, data: FormData) => Promise<PickerState>
  /** Campos que a acao precisa alem das cartas, como o local de destino. */
  hiddenFields?: Record<string, string>
  copy: PickerCopy
  vocabulary: CatalogVocabulary
  /** A primeira leva, renderizada no servidor. */
  initialCards: Card[]
  initialTotal: number
}) {
  const [filters, setFilters] = useState<CatalogSearchParams>({})
  const [term, setTerm] = useState('')
  const [cards, setCards] = useState<Card[]>(initialCards)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picks, setPicks] = useState<Record<string, number>>({})
  const [confirming, setConfirming] = useState(false)

  const [state, submit, saving] = useActionState(action, PICKER_IDLE)
  const form = useRef<HTMLFormElement>(null)
  const { toast } = useToast()

  const query = toApiQuery(
    toCatalogQuery({ ...filters, [PARAM.busca]: term || undefined }, { pageSize: PAGE_SIZE }),
  )

  /*
   * A consulta mudou: a grade volta ao começo.
   *
   * Ajustado durante a renderização, e não num efeito, porque `setState`
   * síncrono dentro de efeito dispara renderização em cascata — e o lint do
   * React recusa. O efeito abaixo só busca.
   */
  const [lastQuery, setLastQuery] = useState(query)
  if (query !== lastQuery) {
    setLastQuery(query)
    setLoading(true)
    setError(null)
  }

  /**
   * A consulta que já está pintada na tela.
   *
   * Começa sendo a do servidor, então a montagem não refaz a busca que acabou
   * de chegar pronta. Guardar numa referência — e não em estado — é o que faz
   * as duas montagens do modo estrito do React caírem no mesmo caminho.
   */
  const served = useRef(query)

  /**
   * A primeira leva de cada consulta nova.
   *
   * `cancelled` não é zelo: trocar de filtro duas vezes depressa deixa duas
   * buscas no ar, e sem isso a mais lenta chegaria por último e pintaria a
   * grade com o filtro anterior.
   */
  useEffect(() => {
    if (query === served.current) return
    served.current = query

    let cancelled = false

    void (async () => {
      try {
        const response = await fetch(`/api/catalog?${query}&page=1`)
        if (!response.ok) throw new Error('falha')
        const data = (await response.json()) as ApiPage
        if (cancelled) return

        setCards(data.items)
        setTotal(data.total)
        setPage(1)
      } catch {
        if (!cancelled) setError('Não foi possível carregar as cartas.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [query])

  /** As levas seguintes. Sai de um toque, então pode mexer no estado à vontade. */
  const loadMore = async () => {
    const next = page + 1
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/catalog?${query}&page=${next}`)
      if (!response.ok) throw new Error('falha')
      const data = (await response.json()) as ApiPage

      setCards((current) => [...current, ...data.items])
      setTotal(data.total)
      setPage(next)
    } catch {
      setError('Não foi possível carregar as cartas.')
    } finally {
      setLoading(false)
    }
  }

  /*
   * A leva entrou: limpa as escolhas e fecha a confirmação.
   *
   * Ajustado durante a renderização, comparando com o resultado anterior, e não
   * num efeito: `setState` dentro de efeito dispara uma renderização em
   * cascata, e o lint do React recusa. O aviso continua no efeito, porque
   * avisar é falar com um sistema externo — que é para o que efeito serve.
   */
  const [lastResult, setLastResult] = useState(state)
  if (state !== lastResult) {
    setLastResult(state)
    if (state.status === 'added') {
      setPicks({})
      setConfirming(false)
    }
  }

  useEffect(() => {
    if (state.status !== 'added') return

    toast({
      title: `${state.copies} ${state.copies === 1 ? 'cópia adicionada' : 'cópias adicionadas'}`,
      description: copy.successDescription(state.cards),
      tone: 'success',
    })
  }, [state, copy, toast])

  const set = (variantId: string, value: number) =>
    setPicks((current) => {
      const next = { ...current }
      if (value <= 0) delete next[variantId]
      else next[variantId] = value
      return next
    })

  const chosen = Object.entries(picks)
  const copies = chosen.reduce((sum, [, value]) => sum + value, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <SearchBar
            label="Buscar no catálogo"
            value={term}
            onValueChange={setTerm}
            placeholder="Buscar por código ou nome..."
          />
        </div>
        <CatalogFilters
          vocabulary={vocabulary}
          activeCount={countActiveFilters(filters)}
          values={filters}
          onApply={setFilters}
        />
      </div>

      {/*
        A falha aparece **fora** do ramo da grade. Antes ela morava dentro dele,
        então uma busca que falhasse com zero cartas mostrava "nenhuma carta
        encontrada — tente outro termo": a tela culpava o filtro por um erro de
        rede.
      */}
      {error ? (
        <div role="alert" className="flex flex-col items-center gap-2 py-2 text-center">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="secondary" onClick={() => void loadMore()}>
            Tentar de novo
          </Button>
        </div>
      ) : null}

      {cards.length === 0 && !loading && !error ? (
        <EmptyState
          icon={<SearchX className="size-10" aria-hidden />}
          title="Nenhuma carta encontrada"
          description="Tente outro termo, ou remova alguns filtros."
        />
      ) : (
        <>
          <p className="text-sm text-text-muted tabular-nums" role="status">
            {total} {total === 1 ? 'carta' : 'cartas'}
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {cards.map((card, index) => (
              <PickTile
                key={card.variantId}
                card={card}
                value={picks[card.variantId] ?? 0}
                onChange={(value) => set(card.variantId, value)}
                priority={index < 4}
              />
            ))}
          </div>

          {cards.length < total ? (
            <Button
              variant="secondary"
              block
              loading={loading}
              onClick={() => void loadMore()}
            >
              Carregar mais
            </Button>
          ) : null}
        </>
      )}

      {loading && cards.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-6 text-sm text-text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Carregando...
        </p>
      ) : null}

      {/*
        A barra fica presa embaixo, acima da navegação, porque a escolha é feita
        rolando: um resumo no topo sairia da tela na primeira carta escolhida.
      */}
      {copies > 0 ? (
        <div className="sticky bottom-20 z-10 md:bottom-4">
          <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-3 shadow-sheet">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold text-text tabular-nums">
                {copies} {copies === 1 ? 'cópia' : 'cópias'}
              </span>
              <span className="truncate text-xs text-text-muted tabular-nums">
                {chosen.length} {chosen.length === 1 ? 'carta' : 'cartas'} · {copy.destination}
              </span>
            </span>
            <Button onClick={() => setConfirming(true)} disabled={saving}>
              Revisar
            </Button>
          </div>
        </div>
      ) : null}

      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      ) : null}

      <form ref={form} action={submit} className="hidden">
        {Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        {chosen.map(([variantId, value]) => (
          <input key={variantId} type="hidden" name="carta" value={`${variantId}:${value}`} />
        ))}
      </form>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={copy.confirmTitle(copies)}
        description={copy.confirmDescription(chosen.length, copies)}
        confirmLabel="Confirmar"
        destructive={false}
        loading={saving}
        onConfirm={() => form.current?.requestSubmit()}
      />
    </div>
  )
}

/**
 * A carta com o contador embaixo.
 *
 * O contador é o alvo, e não a carta: aqui não se navega para lugar nenhum, se
 * escolhe quantas entram. Os dois botões têm 44 px e ficam nas pontas, como no
 * resto do produto.
 */
function PickTile({
  card,
  value,
  onChange,
  priority,
}: {
  card: Card
  value: number
  onChange: (value: number) => void
  priority: boolean
}) {
  const chosen = value > 0

  return (
    <div className="flex flex-col gap-1.5">
      <span className="relative block">
        <CardArt
          src={card.imageUrl}
          alt={`${card.cardCode} — ${card.cardName}`}
          fallback={card.cardCode}
          priority={priority}
          sizes="(max-width: 639px) 50vw, (max-width: 767px) 33vw, (max-width: 1023px) 25vw, 17vw"
          className={cn(chosen && 'ring-2 ring-accent')}
        />
        {chosen ? (
          <span className="absolute right-1 bottom-1 rounded-md bg-accent px-1.5 py-0.5 text-xs font-bold text-accent-contrast tabular-nums">
            +{value}
          </span>
        ) : null}
      </span>

      <span className="flex flex-col gap-0.5">
        <span className="truncate text-xs font-semibold text-text tabular-nums">
          {card.cardCode}
        </span>
        <span className="truncate text-xs text-text-muted">{card.cardName}</span>
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Tirar uma cópia de ${card.cardCode}`}
          disabled={value <= 0}
          onClick={() => onChange(value - 1)}
          className={cn(
            'inline-flex size-11 shrink-0 items-center justify-center rounded-control',
            'border border-border bg-surface text-text transition-colors',
            'hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-40',
          )}
        >
          <Minus className="size-4" aria-hidden />
        </button>

        <span
          aria-live="polite"
          aria-label={`${value} cópias de ${card.cardCode}`}
          className="flex-1 text-center text-sm font-semibold text-text tabular-nums"
        >
          {value}
        </span>

        <button
          type="button"
          aria-label={`Acrescentar uma cópia de ${card.cardCode}`}
          onClick={() => onChange(value + 1)}
          className={cn(
            'inline-flex size-11 shrink-0 items-center justify-center rounded-control',
            'border border-accent-ink/30 bg-accent-soft text-accent-ink transition-colors',
            'hover:brightness-95',
          )}
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
