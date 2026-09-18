import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, Layers, Star, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { StatTile } from '@/components/collection/stat-tile'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Panel } from '@/components/ui/surface'
import { EmptyState } from '@/components/ui/states'
import { PremiumNotice } from '@/components/premium/premium-notice'
import { CollectionDashboardView } from '@/components/dashboard/collection-dashboard'
import { DashboardFilters } from '@/components/dashboard/dashboard-filters'
import { getCatalogVocabulary } from '@/server/application/catalog'
import { readCollectionDashboard, readDashboard } from '@/server/application/collection'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Início' }

/**
 * Home (tela 05).
 *
 * Os números vêm da coleção de verdade. O que ainda falta em relação à tela de
 * referência é o valor estimado, que depende de preço, e o progresso por set,
 * que chega junto das telas de set com coleção.
 *
 * Colecão vazia mostra o estado vazio em vez de quatro zeros: zero em tudo não
 * informa, e a próxima ação é a mesma.
 */
/** Sem centavos no número grande do topo: cabe no quadro de um celular estreito. */
function valorHoje(usd: number, rate: number | null) {
  const opcoes = { maximumFractionDigits: 0 }
  return rate ? `R$ ${(usd * rate).toLocaleString('pt-BR', opcoes)}` : `US$ ${usd.toLocaleString('pt-BR', opcoes)}`
}

type Params = { exclusao?: string; colecao?: string; raridade?: string | string[]; cor?: string | string[] }

const lista = (valor: string | string[] | undefined) => (valor === undefined ? [] : Array.isArray(valor) ? valor : [valor])

export default async function InicioPage({ searchParams }: { searchParams: Promise<Params> }) {
  const viewer = await requireViewer('/inicio')
  const params = await searchParams
  const summary = await readDashboard(viewer)

  // O dashboard e Premium (decisao 098); para o Free nem e calculado. Os filtros
  // chegam pela URL, entao a tela sai pronta do servidor.
  const [dashboard, vocabulario] = summary.premium
    ? await Promise.all([
        readCollectionDashboard(viewer, {
          setCode: params.colecao,
          rarities: lista(params.raridade),
          colors: lista(params.cor),
        }),
        getCatalogVocabulary(),
      ])
    : [null, null]

  // Entrar de novo cancelou um pedido de exclusao da conta (decisao 091). O
  // parametro so muda o texto desta pagina, entao nao ha o que falsificar.
  const exclusaoCancelada = params.exclusao === 'cancelada' ? (
    <Panel role="status" className="mb-5 border-success/40 bg-success-soft p-3 text-sm text-text">
      O pedido de exclusão da sua conta foi cancelado. Tudo continua como estava, menos as trocas
      que tinham sido canceladas.
    </Panel>
  ) : null

  const primeiroNome = viewer.name.trim().split(/\s+/)[0]

  if (summary.totalCards === 0) {
    return (
      <>
        <PageHeader title={`Olá, ${primeiroNome}`} description="Sua coleção em um só lugar." />
        {exclusaoCancelada}
        <EmptyState
          icon={<Layers className="size-10" aria-hidden />}
          title="Sua coleção está vazia"
          description="Adicione cartas pelo catálogo para acompanhar aqui o total, as variantes e os playsets."
          action={{ label: 'Abrir o catálogo', href: '/catalogo' }}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title={`Olá, ${primeiroNome}`} description="Sua coleção em um só lugar." />
      {exclusaoCancelada}

      <div className="flex flex-col gap-5">
        {/*
          Decisao 093: a analise da colecao e Premium, e o total de cartas fica
          para todos. Para o Free, os numeros que faltam nem sao calculados.
        */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatTile
            value={summary.totalCards.toLocaleString('pt-BR')}
            label="Cartas"
            icon={<BookOpen className="size-4" />}
          />
          {summary.premium ? (
            <>
              <StatTile
                value={summary.uniqueVariants!.toLocaleString('pt-BR')}
                label="Variantes"
                icon={<Layers className="size-4" />}
              />
              <StatTile
                value={summary.closedPlaysets!.toLocaleString('pt-BR')}
                label="Playsets"
                icon={<Star className="size-4" />}
              />
              {/*
                O valor no topo, e nao so no dashboard la embaixo: pedido do dono
                do produto, para ver um numero que importa sem rolar a tela. E o
                valor da colecao inteira, e nao muda com os filtros de baixo.
              */}
              {dashboard ? (
                <StatTile
                  value={valorHoje(dashboard.overallValueUsd, dashboard.rate)}
                  label="Valor (hoje)"
                  icon={<Wallet className="size-4" />}
                />
              ) : null}
            </>
          ) : null}
        </div>

        {summary.premium ? (
          <Panel className="flex flex-col gap-2 p-4">
            <h2 className="text-sm font-semibold text-text">Progresso do catálogo</h2>
            <ProgressBar
              label="Progresso do catálogo"
              value={summary.uniqueVariants!}
              total={summary.catalogVariants!}
              showNumbers
            />
            <p className="text-xs text-text-muted">
              Variantes distintas que você possui, sobre as do catálogo inteiro.
            </p>
          </Panel>
        ) : (
          <PremiumNotice
            title="A análise da sua coleção é Premium"
            description="Variantes distintas, playsets fechados, progresso do catálogo e o valor estimado aparecem aqui com o Premium."
          />
        )}

        <p className="text-sm text-text-muted">
          <Link href="/colecao" className="font-medium text-accent-ink underline underline-offset-2">
            Ver minha coleção
          </Link>
        </p>

        {dashboard && vocabulario ? (
          <section className="flex flex-col gap-4 border-t border-border pt-5">
            <div>
              <h2 className="text-base font-semibold text-text">Sua coleção em números</h2>
              <p className="text-sm text-text-muted">Filtre por coleção, raridade ou cor: todos os números acompanham.</p>
            </div>
            <DashboardFilters
              sets={dashboard.sets.map((set) => ({ code: set.code, label: `${set.displayCode} · ${set.displayName}` }))}
              rarities={vocabulario.rarities}
              colors={vocabulario.colors}
            />
            <CollectionDashboardView dashboard={dashboard} />
          </section>
        ) : null}
      </div>
    </>
  )
}
