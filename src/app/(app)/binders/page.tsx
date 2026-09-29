import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { LocationList } from '@/components/storage/location-list'
import { UnallocatedNotice } from '@/components/storage/unallocated-notice'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/states'
import { countUnallocated, listStorageLocations } from '@/server/application/storage'
import type { StorageType } from '@/server/domain/storage/locations'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Binders' }

/** A deckbox mora em Decks desde a decisão 111. */
const TIPOS: readonly StorageType[] = ['BINDER', 'BOX']

/**
 * Binders (tela 21).
 *
 * O lugar físico das cartas: binders e caixas. É a contraparte da coleção — ela
 * diz **o que** se tem, esta diz **onde está**.
 *
 * ## A deckbox saiu daqui (decisão 111)
 *
 * Até 23/09 esta tela também listava e criava locais do tipo `DECK`. Usuários
 * não achavam a deckbox: procuravam em Decks, que era só o Deck Builder. Agora
 * cada gaveta fica onde se procura por ela — a deckbox em `/deck`, o binder e a
 * caixa aqui. O modelo de dados não mudou: continua um `storage_location` de
 * tipo `DECK`, e só a porta de entrada é outra.
 */
export default async function BindersPage() {
  const viewer = await requireViewer('/binders')
  const [todos, unallocated] = await Promise.all([
    listStorageLocations(viewer),
    countUnallocated(viewer),
  ])

  const locations = todos.filter((location) => TIPOS.includes(location.type))

  if (locations.length === 0) {
    return (
      <>
        <PageHeader back={{ href: '/inicio', label: 'o Início' }}
          title="Binders"
          description="Organize suas cartas por binders e caixas."
        />
        <EmptyState
          icon={<BookOpen className="size-10" aria-hidden />}
          title="Nenhum local ainda"
          description="Crie um binder ou uma caixa e diga onde cada carta da sua coleção está guardada. As deckboxes ficam em Decks."
          action={{ label: 'Criar o primeiro local', href: '/binders/novo' }}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader back={{ href: '/inicio', label: 'o Início' }}
        title="Binders"
        description="Organize suas cartas por binders e caixas."
      />

      <div className="flex flex-col gap-4">
        {/*
          Só depois de existir um local: sem nenhum, tudo está sem lugar, o
          número seria o tamanho da coleção e o convite não teria para onde
          levar.
        */}
        <UnallocatedNotice summary={unallocated} />

        <LocationList locations={locations} types={TIPOS} />

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
