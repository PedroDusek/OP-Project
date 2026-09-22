import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { DeckList } from '@/components/decks/deck-list'
import type { SavedDeckSummary } from '@/server/application/decks/saved-decks'

/**
 * A estante de decklists (decisão 108).
 *
 * O progresso é a **mesma barra** dos playsets e do progresso de set — pedido do
 * dono do produto em 22/09, por estética. Ela recebe valor e total, e não uma
 * porcentagem pronta: é isso que faz o leitor de tela anunciar "42 de 51", e o
 * que impede 42/51 e 84/102 de virarem o mesmo "82%".
 */

function deck(over: Partial<SavedDeckSummary> = {}): SavedDeckSummary {
  return {
    id: '1',
    name: 'Koala Pirates Party',
    leader: { variantId: '10', cardCode: 'OP09-001', cardName: 'Koala', imageUrl: null },
    cards: 50,
    incomplete: false,
    owned: 42,
    updatedAt: new Date('2026-09-22T12:00:00Z'),
    ...over,
  }
}

describe('DeckList', () => {
  it('desenha o progresso como barra, com valor e total de verdade', () => {
    render(<DeckList decks={[deck()]} premium />)

    const barra = screen.getByRole('progressbar')
    expect(barra).toHaveAttribute('aria-valuenow', '42')
    expect(barra).toHaveAttribute('aria-valuemax', '51')
    expect(barra).toHaveAttribute('aria-valuetext', '42 de 51')
    expect(screen.getByText('42 / 51')).toBeInTheDocument()
    expect(screen.getByText('82%')).toBeInTheDocument()
  })

  /* A capa é o líder, e o nome dele identifica o deck para quem joga. */
  it('mostra o nome da lista e o líder', () => {
    render(<DeckList decks={[deck()]} premium />)

    expect(screen.getByText('Koala Pirates Party')).toBeInTheDocument()
    expect(screen.getByText('Koala')).toBeInTheDocument()
  })

  /*
   * A marca é sobre a **lista**, e não sobre a coleção: uma lista pode estar
   * completa com a pessoa sem nenhuma carta, e vice-versa.
   */
  it('marca a lista incompleta, e só ela', () => {
    render(<DeckList decks={[deck({ incomplete: true, cards: 30 })]} premium />)
    expect(screen.getByText('Incompleta')).toBeInTheDocument()

    render(<DeckList decks={[deck({ id: '2', incomplete: false })]} premium />)
    expect(screen.getAllByText('Incompleta')).toHaveLength(1)
  })

  it('leva para a lista', () => {
    render(<DeckList decks={[deck()]} premium />)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/deck/1')
  })

  /*
   * Sem Premium a lista aparece e não abre (decisão 108, regra 4). Um link que
   * leva a uma recusa seria pior que nenhum: a pessoa clica, perde o lugar e
   * volta.
   */
  it('sem Premium, não vira link, e diz por quê', () => {
    render(<DeckList decks={[deck()]} premium={false} />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Premium para abrir')).toBeInTheDocument()
    // O que a pessoa construiu continua à vista: nome, líder e progresso.
    expect(screen.getByText('Koala Pirates Party')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
  })

  it('lista várias', () => {
    render(
      <DeckList
        decks={[deck(), deck({ id: '2', name: 'Enel Control', owned: 51 })]}
        premium
      />,
    )

    const itens = screen.getAllByRole('listitem')
    expect(itens).toHaveLength(2)
    expect(within(itens[1]).getByText('100%')).toBeInTheDocument()
  })
})
