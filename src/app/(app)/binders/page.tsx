import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { LocationList } from '@/components/storage/location-list'
import { UnallocatedNotice } from '@/components/storage/unallocated-notice'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/states'
import { countUnallocated, listStorageLocations } from '@/server/application/storage'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Binders' }

/**
 * Binders (tela 21).
 *
 * O lugar físico das cartas: binders, caixas e decks. É a contraparte da
 * coleção — ela diz **o que** se tem, esta diz **onde está**.
 *
 * É também o único lugar onde local se cria e se edita. Da coleção e do detalhe
 * de uma carta dá para dizer *em qual* local a carta está; criar e editar o
 * local é aqui. Cada coisa no seu lugar: quem procura "onde eu crio um binder"
 * procura uma vez só.
 */
export default async function BindersPage() {
  const viewer = await requireViewer('/binders')
  const [locations, unallocated] = await Promise.all([
    listStorageLocations(viewer),
    countUnallocated(viewer),
  ])

  if (locations.length === 0) {
    return (
      <>
        <PageHeader
          title="Binders"
          description="Organize suas cartas por binders, caixas e decks."
        />
        <EmptyState
          icon={<BookOpen className="size-10" aria-hidden />}
          title="Nenhum local ainda"
          description="Crie um binder, uma caixa ou um deck e diga onde cada carta da sua coleção está guardada."
          action={{ label: 'Criar o primeiro local', href: '/binders/novo' }}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Binders"
        description="Organize suas cartas por binders, caixas e decks."
      />

      <div className="flex flex-col gap-4">
        {/*
          Só depois de existir um local: sem nenhum, tudo está sem lugar, o
          número seria o tamanho da coleção e o convite não teria para onde
          levar.
        */}
        <UnallocatedNotice summary={unallocated} />

        <LocationList locations={locations} />

        <Button asChild size="lg" block>
          <Link href="/binders/novo">
            <Plus className="size-4" aria-hidden />
            Novo local
          </Link>
        </Button>
      </div>
    </>
  )
}
