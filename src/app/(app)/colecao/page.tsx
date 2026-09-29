import type { Metadata } from 'next'
import Link from 'next/link'
import { Layers, Star } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { CatalogFilters } from '@/components/catalog/catalog-filters'
import { CatalogSort } from '@/components/catalog/catalog-sort'
import { CatalogSearch } from '@/components/catalog/catalog-search'
import { InfiniteCollectionGrid } from '@/components/collection/infinite-collection-grid'
import { CollectionScope } from '@/components/collection/collection-scope'
import { ListRow, PanelList } from '@/components/ui/surface'
import { EmptyState } from '@/components/ui/states'
import { getCatalogVocabulary } from '@/server/application/catalog'
import { getCollectionSummary, searchCollection } from '@/server/application/collection'
import { cardCountLabel } from '@/server/domain/catalog/sets'
import { countActiveFilters, toApiQuery, toCatalogQuery } from '@/lib/catalog-params'
import { PremiumNotice } from '@/components/premium/premium-notice'
import { isPremium } from '@/server/application/authorization'
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
 * A grade carrega mais como a do catálogo, desde 20/09. Até então trazia no
 * máximo 100 cartas e parava ali, calada: um testador com 131 não via 31 delas.
 * O comentário antigo dizia para esperar "alguma coleção real pedir" — pediu.
 */
export default async function ColecaoPage({ searchParams }: PageProps<'/colecao'>) {
  const viewer = await requireViewer('/colecao')
  const params = await searchParams

  const requested = Array.isArray(params.recorte) ? params.recorte[0] : params.recorte
  const scope: Scope = SCOPES.includes(requested as Scope) ? (requested as Scope) : 'all'

  // A mesma leva do catálogo; as seguintes vêm por `/api/colecao`.
  const filters = toCatalogQuery(params, { pageSize: 24 })

  /*
   * Decisao 093: a analise da colecao — quantas variantes distintas, quantos
   * playsets fecharam, o que falta — e Premium. Ver e buscar a colecao inteira
   * continua de todos.
   *
   * Para o Free os recortes nem sao consultados, e o endereco escrito a mao cai
   * em "todas": esconder a aba e continuar respondendo a ela seria trava de
   * fachada.
   */
  const premium = isPremium(viewer)
  const recorte: Scope = premium ? scope : 'all'

  const [summary, vocabulary, todas, playsets, faltam] = await Promise.all([
    getCollectionSummary(viewer),
    getCatalogVocabulary(),
    searchCollection(viewer, { ...filters, scope: 'all' }),
    premium ? searchCollection(viewer, { ...filters, scope: 'playsets' }) : null,
    premium ? searchCollection(viewer, { ...filters, scope: 'incomplete' }) : null,
  ])

  const atual = recorte === 'playsets' ? playsets! : recorte === 'incomplete' ? faltam! : todas

  if (summary.totalCards === 0) {
    return (
      <>
        <PageHeader back={{ href: '/inicio', label: 'o Início' }} title="Minha Coleção" description="Suas cartas, com busca, filtros e playsets." />
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
      <PageHeader back={{ href: '/inicio', label: 'o Início' }}
        title="Minha Coleção"
        description={
          premium
            ? `${cardCountLabel(summary.totalCards)} · ${summary.uniqueVariants} variantes · ${summary.closedPlaysets} playsets`
            : cardCountLabel(summary.totalCards)
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <CatalogSearch placeholder="Buscar na minha coleção..." />
          </div>
          <CatalogFilters vocabulary={vocabulary} activeCount={countActiveFilters(params)} />
        </div>

        {premium ? (
          <>
            <CollectionScope
              counts={{ all: todas.total, playsets: playsets!.total, incomplete: faltam!.total }}
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
          </>
        ) : (
          <PremiumNotice
            title="A análise da coleção é Premium"
            description="Playsets fechados, o que ainda falta e o progresso do catálogo aparecem aqui com o Premium. Ver, buscar e filtrar a coleção continua de todos."
          />
        )}

        <CatalogSort />

        {atual.total === 0 ? (
          <EmptyState
            title="Nada neste recorte"
            description="Ajuste a busca, os filtros ou a aba."
          />
        ) : (
          <>
            {/* A contagem do recorte vem dentro da grade, como no catálogo. */}
            <InfiniteCollectionGrid
              /*
               * A chave amarra a grade ao recorte e aos filtros: trocar de aba
               * monta uma grade nova, em vez de emendar cartas de outro recorte
               * nas que já estavam na tela.
               */
              key={`${recorte}:${toApiQuery(filters)}`}
              showPlayset={premium}
              total={atual.total}
              pageSize={atual.pageSize}
              apiQuery={`${toApiQuery(filters)}&scope=${recorte}`}
              initialItems={atual.items.map((item) => ({
                ...item,
                variantId: String(item.variantId),
              }))}
            />
          </>
        )}
      </div>

      <p className="mt-8 text-xs text-text-subtle">
        {premium ? (
          <>Progresso do catálogo: {summary.uniqueVariants} de {summary.catalogVariants} variantes. </>
        ) : null}
        {/*
          O DON!! é contagem, e não progresso (decisão 112): ele não entra no
          "X de Y" acima, nem como numerador nem como denominador. A frase só
          aparece para quem tem algum — dizer "você possui 0 DON diferentes" a
          quem nunca registrou um seria ruído.

          Fora do bloco Premium: DON!! é coleção, e ver a própria coleção é de
          todos (decisão 093).
        */}
        {summary.donVariants > 0 ? (
          <>
            Você possui {summary.donVariants}{' '}
            {summary.donVariants === 1 ? 'DON diferente' : 'DON diferentes'}.{' '}
          </>
        ) : null}
        <Link href="/catalogo" className="underline underline-offset-2">
          Explorar o catálogo
        </Link>
        .
      </p>
    </>
  )
}
