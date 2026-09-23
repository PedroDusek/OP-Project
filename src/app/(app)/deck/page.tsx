import type { Metadata } from 'next'
import Link from 'next/link'
import { Box, Layers, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { DeckList } from '@/components/decks/deck-list'
import { DecksTabs } from '@/components/decks/decks-tabs'
import { LocationList } from '@/components/storage/location-list'
import { PremiumNotice } from '@/components/premium/premium-notice'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/states'
import { parseDecksTab } from '@/lib/decks-tabs'
import { isPremium } from '@/server/application/authorization'
import { listDecks } from '@/server/application/decks'
import type { StorageType } from '@/server/domain/storage/locations'
import { listStorageLocations } from '@/server/application/storage'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Decks' }

/** A deckbox é um local de armazenamento do tipo `DECK` (regra 3.1). */
const TIPOS: readonly StorageType[] = ['DECK']

/**
 * Decks (decisão 111).
 *
 * Duas gavetas: as **deckboxes**, que guardam cartas de verdade, e as
 * **decklists**, que são as listas montadas. A tela chamava-se Deck Builder e
 * tinha só a segunda.
 *
 * ## Por que as duas moram aqui
 *
 * A deckbox era criada em Binders, junto do binder e da caixa — e usuários não
 * a achavam, porque procuravam em Decks. É remanejamento posicional: o modelo
 * de dados não mudou, e uma deckbox criada antes continua sendo o mesmo
 * `storage_location` de tipo `DECK`.
 *
 * ## As duas gavetas têm travas diferentes
 *
 * Deckbox é armazenamento, como binder e caixa: **de todos**. Decklist é
 * Premium (decisão 093). Por isso a trava não fica na página, e sim dentro da
 * aba de decklists — gatear a tela inteira tiraria de quem não é Premium um
 * lugar de guardar cartas que sempre foi dele.
 *
 * ## Por que a listagem de decklists não exige Premium
 *
 * Quem deixa de ser Premium **não perde as listas**: elas continuam guardadas e
 * param de abrir (escolha do dono do produto). Esconder a tela apagaria da
 * vista o que a pessoa construiu, que é o oposto do combinado. Quem nunca teve
 * lista nenhuma vê o convite do Premium, porque para ele não há o que
 * preservar.
 */
export default async function DecksPage({ searchParams }: PageProps<'/deck'>) {
  const viewer = await requireViewer('/deck')
  const premium = isPremium(viewer)

  const [locais, decks, params] = await Promise.all([
    listStorageLocations(viewer),
    listDecks(viewer),
    searchParams,
  ])

  const deckboxes = locais.filter((local) => local.type === 'DECK')
  const aba = parseDecksTab(typeof params.aba === 'string' ? params.aba : undefined)

  return (
    <>
      <PageHeader
        back={{ href: '/inicio', label: 'o Início' }}
        title="Decks"
        description="As caixas onde seus decks montados moram, e as listas que você acompanha."
      />

      <div className="flex flex-col gap-4">
        <DecksTabs counts={{ deckbox: deckboxes.length, decklist: decks.length }} />

        {aba === 'deckbox' ? (
          <Deckboxes locations={deckboxes} />
        ) : (
          <Decklists decks={decks} premium={premium} />
        )}
      </div>
    </>
  )
}

function Deckboxes({ locations }: { locations: Awaited<ReturnType<typeof listStorageLocations>> }) {
  if (locations.length === 0) {
    return (
      <EmptyState
        icon={<Box className="size-10" aria-hidden />}
        title="Nenhuma deckbox ainda"
        description="Crie uma deckbox e diga quais cartas da sua coleção estão guardadas no deck montado."
        action={{ label: 'Criar a primeira deckbox', href: '/deck/deckbox/novo' }}
      />
    )
  }

  return (
    <>
      <LocationList locations={locations} types={TIPOS} />

      <Button asChild size="lg" block>
        <Link href="/deck/deckbox/novo">
          <Plus className="size-4" aria-hidden />
          Nova deckbox
        </Link>
      </Button>
    </>
  )
}

function Decklists({
  decks,
  premium,
}: {
  decks: Awaited<ReturnType<typeof listDecks>>
  premium: boolean
}) {
  if (decks.length === 0) {
    return premium ? (
      <EmptyState
        icon={<Layers className="size-10" aria-hidden />}
        title="Nenhuma lista ainda"
        description="Monte uma decklist, dê um nome a ela, e o ColeXa diz quantas cartas você já tem, onde estão e quanto custa o que falta."
        action={{ label: 'Montar a primeira lista', href: '/deck/novo' }}
      />
    ) : (
      <PremiumNotice
        title="As decklists são Premium"
        description="Com o Premium, você monta listas de 50 cartas, salva quantas quiser, e o ColeXa diz quais cartas você já tem, em qual binder ou caixa elas estão, e quanto custaria comprar o que falta."
      />
    )
  }

  return (
    <>
      {!premium ? (
        <PremiumNotice
          title="Suas listas estão guardadas"
          description="O Premium acabou, e nada foi perdido: as listas continuam aqui e voltam a abrir quando você assinar de novo."
        />
      ) : null}

      <DeckList decks={decks} premium={premium} />

      {premium ? (
        <Button asChild size="lg" block>
          <Link href="/deck/novo">
            <Plus className="size-4" aria-hidden />
            Nova lista
          </Link>
        </Button>
      ) : null}
    </>
  )
}
