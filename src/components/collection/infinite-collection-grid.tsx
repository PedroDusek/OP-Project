'use client'

import { LoadMore } from '@/components/catalog/load-more'
import { useInfiniteItems } from '@/components/catalog/use-infinite-items'
import { CollectionGrid, type CollectionCardView } from './collection-grid'
import { cardCountLabel } from '@/server/domain/catalog/sets'

/**
 * A grade da coleção, carregando mais ao chegar no fim (20/09).
 *
 * Antes a tela trazia até 100 cartas e parava ali, sem dizer nada: quem tinha
 * mais não via o resto. Agora segue a mesma lógica do catálogo — a primeira
 * leva vem pronta do servidor, as seguintes por rolagem ou pelo botão —, e a
 * mecânica é a mesma do gancho `use-infinite-items`.
 *
 * O que muda em relação ao catálogo: cada carta abre a edição de quantidade em
 * vez de navegar, e a contagem no topo é de cartas possuídas.
 */
export function InfiniteCollectionGrid({
  initialItems,
  total,
  pageSize,
  apiQuery,
  showPlayset,
}: {
  initialItems: CollectionCardView[]
  total: number
  pageSize: number
  /** A consulta sem `page`, já com o recorte da aba. */
  apiQuery: string
  showPlayset: boolean
}) {
  const { items, loading, error, done, loadMore, sentinel } =
    useInfiniteItems<CollectionCardView>({
      initialItems,
      total,
      endpoint: '/api/colecao',
      apiQuery,
    })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted tabular-nums" role="status">
        {cardCountLabel(total)}
      </p>

      <CollectionGrid items={items} showPlayset={showPlayset} />

      <LoadMore
        done={done}
        loading={loading}
        error={error}
        shown={items.length}
        pageSize={pageSize}
        onLoadMore={() => void loadMore()}
        sentinel={sentinel}
      />
    </div>
  )
}
