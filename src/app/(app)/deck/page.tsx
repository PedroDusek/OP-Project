import type { Metadata } from 'next'
import Link from 'next/link'
import { Layers, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { DeckList } from '@/components/decks/deck-list'
import { PremiumNotice } from '@/components/premium/premium-notice'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/states'
import { isPremium } from '@/server/application/authorization'
import { listDecks } from '@/server/application/decks'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Decklists' }

/**
 * As decklists salvas (decisão 108, que muda a 095).
 *
 * Até 22/09 esta rota **era** o Deck Builder, e o deck não era guardado. Agora
 * ela é a estante: as listas ficam aqui, e montar acontece em `/deck/novo` ou
 * `/deck/[id]`. É o mesmo desenho de Binders — a lista primeiro, o gesto de
 * criar depois.
 *
 * ## Por que a listagem não exige Premium
 *
 * Quem deixa de ser Premium **não perde as listas**: elas continuam guardadas e
 * param de abrir (escolha do dono do produto). Esconder a tela apagaria da vista
 * o que a pessoa construiu, que é o oposto do combinado. Quem nunca teve lista
 * nenhuma vê o convite do Premium, porque para ele não há o que preservar.
 */
export default async function DecksPage() {
  const viewer = await requireViewer('/deck')
  const premium = isPremium(viewer)
  const decks = await listDecks(viewer)

  const cabecalho = (
    <PageHeader
      back={{ href: '/inicio', label: 'o Início' }}
      title="Decklists"
      description="Monte suas listas e acompanhe quantas cartas você já tem de cada uma."
    />
  )

  if (decks.length === 0) {
    return (
      <>
        {cabecalho}
        {premium ? (
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
        )}
      </>
    )
  }

  return (
    <>
      {cabecalho}

      <div className="flex flex-col gap-4">
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
      </div>
    </>
  )
}
