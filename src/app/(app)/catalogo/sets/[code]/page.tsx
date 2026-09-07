import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isAppError } from '@/server/domain/errors'
import { CatalogFilters } from '@/components/catalog/catalog-filters'
import { CatalogResults } from '@/components/catalog/catalog-results'
import { CatalogSearch } from '@/components/catalog/catalog-search'
import { SetHeader } from '@/components/catalog/set-header'
import { getCatalogVocabulary, getSet, searchCatalog } from '@/server/application/catalog'
import { countActiveFilters, toCatalogQuery } from '@/lib/catalog-params'

export async function generateMetadata({
  params,
}: PageProps<'/catalogo/sets/[code]'>): Promise<Metadata> {
  const { code } = await params
  return { title: decodeURIComponent(code) }
}

/**
 * Detalhe do set (tela 11).
 *
 * A participação no set vem sempre de `variant_printings`, nunca do prefixo do
 * código (`business-rules.md` 2.2) — é o que faz `OP14-EB04` funcionar, já que
 * uma variante pode ser impressa em mais de um set.
 *
 * A tela de referência abre com uma faixa de arte do mangá. A seção 19 da
 * especificação proíbe arte de franquia como decoração, e o modelo não guarda
 * capa de set. O cabeçalho usa forma e cor próprias.
 */
export default async function SetPage({ params, searchParams }: PageProps<'/catalogo/sets/[code]'>) {
  const { code } = await params
  const setCode = decodeURIComponent(code)
  const query = await searchParams

  const set = await getSet(setCode).catch((error) => {
    if (isAppError(error) && error.kind === 'NOT_FOUND') notFound()
    throw error
  })

  const catalogQuery = toCatalogQuery(query, { setCode, pageSize: 24 })
  const [result, vocabulary] = await Promise.all([
    searchCatalog(catalogQuery),
    getCatalogVocabulary(),
  ])

  return (
    <>
      <SetHeader set={set} />

      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <CatalogSearch placeholder="Buscar neste set..." />
          </div>
          <CatalogFilters vocabulary={vocabulary} activeCount={countActiveFilters(query)} />
        </div>

        <CatalogResults result={result} query={catalogQuery} />
      </div>
    </>
  )
}
