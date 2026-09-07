import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, Layers, Star } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { StatTile } from '@/components/collection/stat-tile'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Panel } from '@/components/ui/surface'
import { EmptyState } from '@/components/ui/states'
import { getCollectionSummary } from '@/server/application/collection'
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
export default async function InicioPage() {
  const viewer = await requireViewer('/inicio')
  const summary = await getCollectionSummary(viewer)

  const primeiroNome = viewer.name.trim().split(/\s+/)[0]

  if (summary.totalCards === 0) {
    return (
      <>
        <PageHeader title={`Olá, ${primeiroNome}`} description="Sua coleção em um só lugar." />
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

      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatTile
            value={summary.totalCards.toLocaleString('pt-BR')}
            label="Cartas"
            icon={<BookOpen className="size-4" />}
          />
          <StatTile
            value={summary.uniqueVariants.toLocaleString('pt-BR')}
            label="Variantes"
            icon={<Layers className="size-4" />}
          />
          <StatTile
            value={summary.closedPlaysets.toLocaleString('pt-BR')}
            label="Playsets"
            icon={<Star className="size-4" />}
          />
        </div>

        <Panel className="flex flex-col gap-2 p-4">
          <h2 className="text-sm font-semibold text-text">Progresso do catálogo</h2>
          <ProgressBar
            label="Progresso do catálogo"
            value={summary.uniqueVariants}
            total={summary.catalogVariants}
            showNumbers
          />
          <p className="text-xs text-text-muted">
            Variantes distintas que você possui, sobre as do catálogo inteiro.
          </p>
        </Panel>

        <p className="text-sm text-text-muted">
          <Link href="/colecao" className="font-medium text-accent-ink underline underline-offset-2">
            Ver minha coleção
          </Link>
        </p>
      </div>
    </>
  )
}
