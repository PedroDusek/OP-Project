import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/app-shell'
import { CatalogFilters } from '@/components/catalog/catalog-filters'
import { CatalogSearch } from '@/components/catalog/catalog-search'
import { CatalogSort } from '@/components/catalog/catalog-sort'
import { PlaysetList } from '@/components/collection/playset-list'
import { PremiumNotice } from '@/components/premium/premium-notice'
import { EmptyState } from '@/components/ui/states'
import { isPremium } from '@/server/application/authorization'
import { getCatalogVocabulary, getSet } from '@/server/application/catalog'
import { searchPlaysets } from '@/server/application/collection'
import { isAppError } from '@/server/domain/errors'
import { requireViewer } from '@/server/http/viewer'
import { countActiveFilters, toCatalogQuery, withoutArtFilters } from '@/lib/catalog-params'

export async function generateMetadata({
  params,
}: PageProps<'/playsets/[code]'>): Promise<Metadata> {
  const { code } = await params
  return { title: `Playsets · ${decodeURIComponent(code)}` }
}

/**
 * Os playsets de uma coleção (decisão 114).
 *
 * Mostra **todas** as cartas da coleção que contam playset, inclusive as que
 * estão em `0/4` — que é o pedido do dono do produto: é olhando para o zero,
 * dentro de um filtro, que se sabe qual playset fechar.
 *
 * ## Os filtros são os da carta
 *
 * Set, cor, tipo, custo, poder, atributo, trait, mecânica e contador. **Não**
 * raridade nem variante: playset conta a carta somando todas as artes
 * (`business-rules.md` 2.1), e filtrando por arte paralela um `2/4` poderia ser
 * duas cópias Normal — a linha mentiria. O caso de uso descarta os dois também,
 * para quem monta o endereço à mão, e `withoutArtFilters` mantém o distintivo
 * de "filtros ativos" concordando com o que de fato filtra.
 *
 * ## Sem paginação, de propósito
 *
 * A maior coleção tem algumas centenas de cartas, e elas chegam inteiras: os
 * recortes Todos / Completos / Faltam e a busca respondem na tecla, sem ida ao
 * servidor. É a mesma escolha da lista de sets do catálogo, pelo mesmo motivo.
 */
export default async function PlaysetSetPage({
  params,
  searchParams,
}: PageProps<'/playsets/[code]'>) {
  const { code } = await params
  const setCode = decodeURIComponent(code)
  const viewer = await requireViewer(`/playsets/${encodeURIComponent(setCode)}`)
  const query = withoutArtFilters(await searchParams)

  const set = await getSet(setCode).catch((error) => {
    if (isAppError(error) && error.kind === 'NOT_FOUND') notFound()
    throw error
  })

  const voltar = { href: '/playsets', label: 'Playsets' }

  if (!isPremium(viewer)) {
    return (
      <>
        <PageHeader
          back={voltar}
          title={set.displayName}
          description="Quantas cartas desta coleção já fecharam quatro cópias."
        />
        <PremiumNotice
          title="Os playsets são Premium"
          description="Veja quantas cartas desta coleção já fecharam quatro cópias e quais ainda estão em zero — somando todas as artes."
        />
      </>
    )
  }

  const [rows, vocabulary] = await Promise.all([
    searchPlaysets(viewer, setCode, toCatalogQuery(query, { setCode })),
    getCatalogVocabulary(),
  ])

  const fechados = rows.filter((row) => row.closed).length

  return (
    <>
      <PageHeader
        back={voltar}
        title={set.displayName}
        description={`${fechados} de ${rows.length} playsets em ${set.displayCode}.`}
      />

      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <CatalogSearch placeholder="Buscar nesta coleção..." />
          </div>
          {/*
            Sem o filtro de set — a rota ja diz qual e — e sem os de arte, que
            nao tem significado numa linha que soma todas as artes.
          */}
          <CatalogFilters
            vocabulary={vocabulary}
            activeCount={countActiveFilters(query)}
            hideSetFilter
            hideArtFilters
          />
        </div>

        <CatalogSort />

        {rows.length === 0 ? (
          <EmptyState
            title="Nada neste recorte"
            description="Ajuste a busca ou os filtros. Líderes e DON!! não contam playset e não aparecem aqui."
          />
        ) : (
          <PlaysetList rows={rows} />
        )}
      </div>
    </>
  )
}
