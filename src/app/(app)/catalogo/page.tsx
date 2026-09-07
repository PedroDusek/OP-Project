import type { Metadata } from 'next'
import Link from 'next/link'
import { Layers, Library } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { CatalogFilters } from '@/components/catalog/catalog-filters'
import { CatalogResults } from '@/components/catalog/catalog-results'
import { CatalogSearch } from '@/components/catalog/catalog-search'
import { ListRow, PanelList } from '@/components/ui/surface'
import { getCatalogVocabulary, searchCatalog } from '@/server/application/catalog'
import { countActiveFilters, toCatalogQuery } from '@/lib/catalog-params'

export const metadata: Metadata = { title: 'Catálogo' }

/**
 * Catálogo (tela 09).
 *
 * A busca e os filtros vivem na URL, então esta página é renderizada no
 * servidor já filtrada. Ver `src/lib/catalog-params.ts`.
 *
 * A tela de referência traz também "Sets mais recentes". Não existe: o modelo
 * de dados não guarda data de lançamento, e ordenar códigos não é o mesmo que
 * ordenar por data — `OP-17` vir depois de `OP13` no alfabeto não diz qual saiu
 * antes. Chamar isso de "mais recentes" seria afirmar o que não sabemos, então
 * a entrada para os sets é uma só e honesta.
 */
export default async function CatalogoPage({ searchParams }: PageProps<'/catalogo'>) {
  const params = await searchParams
  const query = toCatalogQuery(params, { pageSize: 24 })

  const [result, vocabulary] = await Promise.all([searchCatalog(query), getCatalogVocabulary()])

  return (
    <>
      <PageHeader
        title="Catálogo"
        description="Explore todas as cartas do One Piece Card Game."
      />

      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <CatalogSearch />
          </div>
          <CatalogFilters vocabulary={vocabulary} activeCount={countActiveFilters(params)} />
        </div>

        <PanelList>
          <ListRow
            href="/catalogo/sets?tipo=collection"
            leading={<Library className="size-5 text-text-muted" aria-hidden />}
            title="Sets"
            description="Boosters e coletâneas, em ordem de lançamento."
          />
          <ListRow
            href="/catalogo/sets?tipo=deck"
            leading={<Layers className="size-5 text-text-muted" aria-hidden />}
            title="Starter Decks"
            description="Decks prontos para jogar, vendidos fechados."
          />
        </PanelList>

        <CatalogResults result={result} query={query} />
      </div>

      <p className="mt-8 text-xs text-text-subtle">
        Dados de cartas do site oficial do One Piece Card Game, da Bandai. O ColeXa não tem
        vínculo, parceria ou endosso da Bandai.{' '}
        <Link href="/mais" className="underline underline-offset-2">
          Mais informações
        </Link>
        .
      </p>
    </>
  )
}
