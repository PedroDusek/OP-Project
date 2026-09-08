'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { CardGrid, CardTile } from './card-tile'
import { Button } from '@/components/ui/button'
import { cardCountLabel } from '@/server/domain/catalog/sets'
import { cardHref } from '@/lib/catalog-params'

/**
 * Grade que carrega mais ao chegar no fim.
 *
 * ## Por que existe um botao, e nao so o sentinela
 *
 * O botao **e** o sentinela: o observador de interseccao dispara a mesma carga
 * que o clique. Isso resolve de uma vez tres casos em que rolagem infinita pura
 * deixa a pessoa presa — quem navega por teclado e nunca "rola ate o fim", quem
 * usa leitor de tela, e o momento em que uma carga falha e e preciso repetir.
 *
 * Tambem e o que torna o comportamento testavel sem simular rolagem.
 *
 * ## O observador e montado uma vez
 *
 * A funcao de carregar muda de identidade a cada `loading` e a cada `page`. Se
 * o efeito dependesse dela, o observador seria desligado e religado a cada
 * mudanca de estado — e religar dispara uma nova avaliacao imediata, que
 * encadeia carga sobre carga enquanto o botao continuar visivel.
 *
 * Por isso o efeito depende so de `done`, e le a versao mais recente por
 * referencia. Assim o observador dispara quando a intersecao **muda**, que e o
 * que rolar significa.
 *
 * ## Por que passa pela API, e nao por uma Server Action
 *
 * `/api/catalog` cobra a cota de leitura do catalogo por usuario. Essa cota e o
 * que sustenta na pratica o compromisso da decisao 020 de nunca reexpor o
 * catalogo. Uma Server Action escaparia dela, e a rolagem infinita viraria a
 * forma mais conveniente de extrair o catalogo inteiro.
 */

export interface CatalogItemView {
  /** `bigint` vira string na fronteira: JSON nao serializa BigInt. */
  variantId: string
  cardCode: string
  cardName: string
  rarity: string | null
  variantType: string
  imageUrl: string | null
}

export interface InfiniteCardGridProps {
  initialItems: CatalogItemView[]
  total: number
  pageSize: number
  /** Query da API sem `page`, ja traduzida do portugues da URL. */
  apiQuery: string
  /**
   * O caminho desta lista, com os filtros, para o detalhe saber para onde
   * voltar. Sem ele, voltar devolve o catalogo inteiro e a pessoa refaz o
   * filtro a cada carta que registra.
   */
  origin?: string
}

export function InfiniteCardGrid({
  initialItems,
  total,
  pageSize,
  apiQuery,
  origin,
}: InfiniteCardGridProps) {
  const [items, setItems] = useState(initialItems)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sentinel = useRef<HTMLButtonElement>(null)

  /*
   * Mudar de filtro troca `initialItems` sem desmontar o componente. Sem este
   * ajuste, a lista nova apareceria concatenada com a antiga, e a pessoa veria
   * resultados que nao pediu no meio dos que pediu.
   *
   * O ajuste acontece durante a renderizacao, e nao num efeito: num efeito, a
   * tela chegaria a ser pintada com a lista errada antes da correcao.
   */
  const [lastInitial, setLastInitial] = useState(initialItems)
  if (initialItems !== lastInitial) {
    setLastInitial(initialItems)
    setItems(initialItems)
    setPage(1)
    setError(null)
  }

  const done = items.length >= total

  /*
   * A trava e uma referencia, e nao o estado: o estado so muda na proxima
   * renderizacao, e duas chamadas no mesmo quadro — o toque e o observador
   * juntos — passariam as duas pela guarda.
   */
  const busy = useRef(false)

  const loadMore = useCallback(async () => {
    if (busy.current || loading || done) return
    busy.current = true

    setLoading(true)
    setError(null)
    const next = page + 1

    try {
      const response = await fetch(`/api/catalog?${apiQuery}&page=${next}`)
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null
        throw new Error(body?.error?.message ?? 'Não foi possível carregar mais cartas.')
      }

      const data = (await response.json()) as { items: CatalogItemView[] }
      setItems((current) => [...current, ...data.items])
      setPage(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar mais cartas.')
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [apiQuery, done, loading, page])

  /** A versao mais recente, para o observador nao precisar ser remontado. */
  const latest = useRef(loadMore)
  useEffect(() => {
    latest.current = loadMore
  }, [loadMore])

  useEffect(() => {
    const node = sentinel.current
    if (!node || done) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void latest.current()
      },
      // Comeca a buscar antes de a pessoa chegar no fim, para a proxima leva
      // ja estar la quando ela chegar.
      { rootMargin: '600px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [done])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted tabular-nums" role="status">
        {cardCountLabel(total)}
      </p>

      <CardGrid>
        {items.map((item, index) => (
          <CardTile
            key={item.variantId}
            code={item.cardCode}
            name={item.cardName}
            imageUrl={item.imageUrl}
            labels={labelsFor(item.rarity, item.variantType)}
            href={cardHref(item.variantId, origin)}
            // A primeira fileira aparece sem esperar a rolagem; o resto e tardio.
            priority={index < 3}
          />
        ))}
      </CardGrid>

      {error ? (
        <div role="alert" className="flex flex-col items-center gap-2 py-4 text-center">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="secondary" onClick={() => void loadMore()}>
            Tentar de novo
          </Button>
        </div>
      ) : null}

      {done ? (
        items.length > pageSize ? (
          <p className="py-4 text-center text-sm text-text-subtle">Fim da lista.</p>
        ) : null
      ) : (
        <Button
          ref={sentinel}
          variant="secondary"
          block
          onClick={() => void loadMore()}
          disabled={loading}
          className="mt-2"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Carregando
            </>
          ) : (
            'Carregar mais'
          )}
        </Button>
      )}
    </div>
  )
}

/**
 * A etiqueta traz a raridade sempre, e a variante so quando ela nao e Normal.
 *
 * "Normal" em toda carta e ruido: e o caso comum, e o que a pessoa procura na
 * grade e justamente o que **nao** e comum.
 */
function labelsFor(rarity: string | null, variantType: string): string[] {
  const labels: string[] = []
  if (rarity) labels.push(rarity)
  if (variantType && variantType !== 'Normal') labels.push(variantType)
  return labels
}
