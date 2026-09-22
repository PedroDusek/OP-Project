import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/app-shell'
import { DeckBuilder } from '@/components/decks/deck-builder'
import { isAppError } from '@/server/domain/errors'
import { getCatalogVocabulary, searchCatalog } from '@/server/application/catalog'
import { readDeck } from '@/server/application/decks'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Decklist' }

/**
 * Abrir uma decklist salva (decisão 108).
 *
 * O mesmo builder da lista nova, com a lista já montada. Salvar aqui **regrava**
 * a mesma linha, em vez de criar outra — quem abriu uma lista para corrigir não
 * espera terminar com duas.
 *
 * Sem Premium não abre: o caso de uso recusa, e a tela de listas já explica isso
 * onde a pessoa está, em vez de deixá-la clicar para receber um não.
 */
export default async function DecklistPage({ params }: PageProps<'/deck/[id]'>) {
  const viewer = await requireViewer('/deck')
  const { id } = await params

  let deck
  try {
    deck = await readDeck(viewer, id)
  } catch (error) {
    // Lista de outra pessoa, apagada, ou Premium vencido: em todos os casos não
    // há o que mostrar aqui, e a tela de listas é o lugar certo para voltar.
    if (isAppError(error)) notFound()
    throw error
  }

  const [lideres, vocabulary] = await Promise.all([
    searchCatalog({ type: ['Leader'], pageSize: 12 }),
    getCatalogVocabulary(),
  ])

  return (
    <>
      <PageHeader
        back={{ href: '/deck', label: 'as decklists' }}
        title={deck.name}
        description="Ajuste a lista e salve. O ColeXa mostra o que você já tem, onde está e quanto custa o que falta."
      />

      <DeckBuilder
        vocabulary={vocabulary}
        initialLeaders={lideres.items.map((item) => ({
          variantId: String(item.variantId),
          cardCode: item.cardCode,
          cardName: item.cardName,
          variantType: item.variantType,
          imageUrl: item.imageUrl,
        }))}
        savedDeck={deck}
      />
    </>
  )
}
