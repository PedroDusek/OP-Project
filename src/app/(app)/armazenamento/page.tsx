import type { Metadata } from 'next'
import Link from 'next/link'
import { Archive, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { LocationList } from '@/components/storage/location-list'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/states'
import { listStorageLocations } from '@/server/application/storage'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Armazenamento' }

/**
 * Armazenamento (tela 21).
 *
 * O lugar físico das cartas: binders, caixas e decks. É a contraparte da
 * coleção — ela diz **o que** se tem, esta diz **onde está**.
 */
export default async function ArmazenamentoPage() {
  const viewer = await requireViewer('/armazenamento')
  const locations = await listStorageLocations(viewer)

  if (locations.length === 0) {
    return (
      <>
        <PageHeader
          title="Armazenamento"
          description="Organize suas cartas por binders, caixas e decks."
        />
        <EmptyState
          icon={<Archive className="size-10" aria-hidden />}
          title="Nenhum local ainda"
          description="Crie um binder, uma caixa ou um deck e diga onde cada carta da sua coleção está guardada."
          action={{ label: 'Criar o primeiro local', href: '/armazenamento/novo' }}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Armazenamento"
        description="Organize suas cartas por binders, caixas e decks."
      />

      <div className="flex flex-col gap-4">
        <LocationList locations={locations} />

        <Button asChild size="lg" block>
          <Link href="/armazenamento/novo">
            <Plus className="size-4" aria-hidden />
            Novo local
          </Link>
        </Button>
      </div>
    </>
  )
}
