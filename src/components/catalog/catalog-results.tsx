import { SearchX } from 'lucide-react'
import { CardGrid, CardTile } from '@/components/catalog/card-tile'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/states'
import type { CatalogResult } from '@/server/application/catalog/search-cards'
import { buildCatalogHref, PARAM } from '@/lib/catalog-params'

/**
 * A grade de resultados, com paginação.
 *
 * Server Component: a grade chega pronta do servidor, sem um segundo passo no
 * cliente. É a mesma peça no catálogo e no detalhe do set, porque é a mesma
 * lista — só muda o filtro que a produziu.
 *
 * Sem contagem de cópias: quantidade é informação de coleção, e a coleção
 * chega no próximo checkpoint. Mostrar "x0" em tudo agora seria dizer que a
 * pessoa não tem nada quando na verdade ainda não perguntamos.
 */
export function CatalogResults({
  result,
  pathname,
  searchParams,
}: {
  result: CatalogResult
  pathname: string
  searchParams: URLSearchParams
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

  const from = (result.page - 1) * result.pageSize + 1
  const to = Math.min(result.page * result.pageSize, result.total)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted tabular-nums" role="status">
        {result.total === 1
          ? '1 variante'
          : `${result.total.toLocaleString('pt-BR')} variantes`}
        {result.totalPages > 1 ? ` · mostrando ${from}–${to}` : ''}
      </p>

      <CardGrid>
        {result.items.map((item) => (
          <CardTile
            key={String(item.variantId)}
            code={item.cardCode}
            name={item.cardName}
            imageUrl={item.imageUrl}
            labels={labelsFor(item.rarity, item.variantType)}
            href={`/catalogo/carta/${item.variantId}`}
          />
        ))}
      </CardGrid>

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        hrefFor={(page) =>
          buildCatalogHref(pathname, searchParams, { [PARAM.pagina]: page }, { resetPage: false })
        }
        className="pt-2"
      />
    </div>
  )
}

/**
 * A etiqueta traz a raridade sempre, e a variante só quando ela não é Normal.
 *
 * "Normal" em toda carta é ruído: é o caso comum, e o que a pessoa procura na
 * grade é justamente o que **não** é comum.
 */
function labelsFor(rarity: string | null, variantType: string): string[] {
  const labels: string[] = []
  if (rarity) labels.push(rarity)
  if (variantType && variantType !== 'Normal') labels.push(variantType)
  return labels
}
