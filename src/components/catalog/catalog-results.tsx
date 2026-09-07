import { SearchX } from 'lucide-react'
import { EmptyState } from '@/components/ui/states'
import { InfiniteCardGrid, type CatalogItemView } from './infinite-card-grid'
import type { CatalogQuery, CatalogResult } from '@/server/application/catalog/search-cards'
import { toApiQuery } from '@/lib/catalog-params'

/**
 * A grade de resultados.
 *
 * Server Component: a primeira leva chega pronta do servidor, sem um segundo
 * passo no cliente. As seguintes vêm por rolagem, em `InfiniteCardGrid`.
 *
 * Sem contagem de cópias: quantidade é informação de coleção, e a coleção chega
 * no próximo checkpoint. Mostrar "x0" em tudo agora seria dizer que a pessoa não
 * tem nada quando na verdade ainda não perguntamos.
 */
export function CatalogResults({
  result,
  query,
  origin,
}: {
  result: CatalogResult
  query: CatalogQuery
  /** O caminho desta lista, com filtros, para o detalhe voltar ao mesmo lugar. */
  origin?: string
}) {
  if (result.total === 0) {
    return (
      <EmptyState
        icon={<SearchX className="size-10" aria-hidden />}
        title="Nenhuma carta encontrada"
        description="Tente outro termo, ou remova alguns filtros."
      />
    )
  }

  return (
    <InfiniteCardGrid
      // A chave amarra o estado da grade à consulta: mudar de filtro monta uma
      // grade nova em vez de acrescentar os resultados novos aos antigos.
      key={toApiQuery(query)}
      initialItems={result.items.map(toView)}
      total={result.total}
      pageSize={result.pageSize}
      apiQuery={toApiQuery(query)}
      origin={origin}
    />
  )
}

/** `bigint` vira string na fronteira: JSON não serializa BigInt. */
function toView(item: CatalogResult['items'][number]): CatalogItemView {
  return {
    variantId: String(item.variantId),
    cardCode: item.cardCode,
    cardName: item.cardName,
    rarity: item.rarity,
    variantType: item.variantType,
    imageUrl: item.imageUrl,
  }
}
