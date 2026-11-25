import type { Metadata } from 'next'
import Link from 'next/link'
import { Layers } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { CatalogFilters } from '@/components/catalog/catalog-filters'
import { CatalogSort } from '@/components/catalog/catalog-sort'
import { CatalogSearch } from '@/components/catalog/catalog-search'
import { InfiniteCollectionGrid } from '@/components/collection/infinite-collection-grid'
import { EmptyState } from '@/components/ui/states'
import { getCatalogVocabulary } from '@/server/application/catalog'
import { getCollectionSummary, searchCollection } from '@/server/application/collection'
import { cardCountLabel } from '@/server/domain/catalog/sets'
import { countActiveFilters, toApiQuery, toCatalogQuery } from '@/lib/catalog-params'
import { PremiumNotice } from '@/components/premium/premium-notice'
import { isPremium } from '@/server/application/authorization'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Coleção' }

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

  // A mesma leva do catálogo; as seguintes vêm por `/api/colecao`.
  const filters = toCatalogQuery(params, { pageSize: 24 })

  /*
   * Decisao 093: a analise da colecao — quantas variantes distintas e quantos
   * playsets fecharam — e Premium. Ver e buscar a colecao inteira continua de
   * todos.
   *
   * As abas Todas / Playsets / Faltam viviam aqui e sairam na decisao 114:
   * playset virou destino proprio, com o universo do catalogo e o `0/4`. Com
   * elas sairam duas consultas que esta tela fazia em paralelo so para contar
   * as abas.
   */
  const premium = isPremium(viewer)

  const [summary, vocabulary, atual] = await Promise.all([
    getCollectionSummary(viewer),
    getCatalogVocabulary(),
    searchCollection(viewer, filters),
  ])

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
        /*
         * O numero de playsets fica: ele e **contagem**, e nao recorte — o que
         * saiu na decisao 114 foram as abas. A tela que o detalha agora e
         * `/playsets`, e o rodape leva para la.
         */
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

        {premium ? null : (
          <PremiumNotice
            title="A análise da coleção é Premium"
            description="Playsets fechados e o progresso do catálogo aparecem aqui com o Premium. Ver, buscar e filtrar a coleção continua de todos."
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
               * A chave amarra a grade aos filtros: mexer num filtro monta uma
               * grade nova, em vez de emendar cartas de outro filtro nas que já
               * estavam na tela.
               */
              key={toApiQuery(filters)}
              showPlayset={premium}
              total={atual.total}
              pageSize={atual.pageSize}
              apiQuery={toApiQuery(filters)}
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
          <>
            Progresso do catálogo: {summary.uniqueVariants} de{' '}
            {summary.catalogVariants} variantes.{' '}
            {/* O detalhe dos playsets mora em /playsets desde a decisão 114. */}
            <Link href="/playsets" className="underline underline-offset-2">
              Ver os playsets
            </Link>
            .{' '}
          </>
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
