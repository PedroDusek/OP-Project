import type { Metadata } from 'next'
import Link from 'next/link'
import { Layers, Star } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { CatalogFilters } from '@/components/catalog/catalog-filters'
import { CatalogSearch } from '@/components/catalog/catalog-search'
import { CollectionGrid } from '@/components/collection/collection-grid'
import { CollectionScope } from '@/components/collection/collection-scope'
import { CollectionTabs } from '@/components/collection/collection-tabs'
import { ListRow, PanelList } from '@/components/ui/surface'
import { EmptyState } from '@/components/ui/states'
import { getCatalogVocabulary } from '@/server/application/catalog'
import { getCollectionSummary, searchCollection } from '@/server/application/collection'
import { getWantSummary } from '@/server/application/wants'
import { cardCountLabel } from '@/server/domain/catalog/sets'
import { countActiveFilters, toCatalogQuery } from '@/lib/catalog-params'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Coleção' }

const SCOPES = ['all', 'playsets', 'incomplete'] as const
type Scope = (typeof SCOPES)[number]

/**
 * Minha Coleção (tela 17).
 *
 * Busca e filtros são os mesmos do catálogo, sobre o subconjunto do que a
 * pessoa possui — filtrar a coleção por cor ou raridade é a mesma pergunta,
 * feita num universo menor.
 *
 * A grade não pagina como o catálogo: uma coleção começa pequena, e a rolagem
 * infinita entra quando alguma coleção real pedir. O limite está no `pageSize`.
 */
export default async function ColecaoPage({ searchParams }: PageProps<'/colecao'>) {
  const viewer = await requireViewer('/colecao')
  const params = await searchParams

  const requested = Array.isArray(params.recorte) ? params.recorte[0] : params.recorte
  const scope: Scope = SCOPES.includes(requested as Scope) ? (requested as Scope) : 'all'

  const filters = toCatalogQuery(params, { pageSize: 100 })

  const [summary, wants, vocabulary, todas, playsets, faltam] = await Promise.all([
    getCollectionSummary(viewer),
    getWantSummary(viewer),
    getCatalogVocabulary(),
    searchCollection(viewer, { ...filters, scope: 'all' }),
    searchCollection(viewer, { ...filters, scope: 'playsets' }),
    searchCollection(viewer, { ...filters, scope: 'incomplete' }),
  ])

  const atual = scope === 'playsets' ? playsets : scope === 'incomplete' ? faltam : todas

  if (summary.totalCards === 0) {
    return (
      <>
        <PageHeader title="Minha Coleção" description="Suas cartas, com busca, filtros e playsets." />
        {/*
          As abas ficam no vazio tambem: sem elas, quem ainda nao tem carta
          nenhuma nao teria como alcancar a want list.
        */}
        <CollectionTabs counts={{ '/colecao': 0, '/colecao/quero': wants.variants }} />
        <EmptyState
          icon={<Layers className="size-10" aria-hidden />}
          title="Nenhuma carta ainda"
          description="Abra o catálogo, escolha uma carta e diga quantas você tem. Ela aparece aqui."
          action={{ label: 'Abrir o catálogo', href: '/catalogo' }}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Minha Coleção"
        description={`${cardCountLabel(summary.totalCards)} · ${summary.uniqueVariants} variantes · ${summary.closedPlaysets} playsets`}
      />

      <div className="flex flex-col gap-4">
        <CollectionTabs
          counts={{ '/colecao': summary.uniqueVariants, '/colecao/quero': wants.variants }}
        />

        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <CatalogSearch placeholder="Buscar na minha coleção..." />
          </div>
          <CatalogFilters vocabulary={vocabulary} activeCount={countActiveFilters(params)} />
        </div>

        <CollectionScope
          counts={{ all: todas.total, playsets: playsets.total, incomplete: faltam.total }}
        />

        <PanelList>
          <ListRow
            href="/colecao/playsets"
            leading={<Star className="size-5 text-text-muted" aria-hidden />}
            title="Playsets"
            description="Cartas com 4 ou mais cópias, somando todas as artes."
            trailing={
              <span className="text-sm font-semibold text-text tabular-nums">
                {summary.closedPlaysets}
              </span>
            }
          />
        </PanelList>

        {atual.total === 0 ? (
          <EmptyState
            title="Nada neste recorte"
            description="Ajuste a busca, os filtros ou a aba."
          />
        ) : (
          <>
            <p className="text-sm text-text-muted tabular-nums" role="status">
              {cardCountLabel(atual.total)}
            </p>
            <CollectionGrid
              items={atual.items.map((item) => ({
                ...item,
                variantId: String(item.variantId),
              }))}
            />
          </>
        )}
      </div>

      <p className="mt-8 text-xs text-text-subtle">
        Progresso do catálogo: {summary.uniqueVariants} de {summary.catalogVariants} variantes.{' '}
        <Link href="/catalogo" className="underline underline-offset-2">
          Explorar o catálogo
        </Link>
        .
      </p>
    </>
  )
}
