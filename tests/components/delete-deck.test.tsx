import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeckList } from '@/components/decks/deck-list'
import { DeleteDeck } from '@/components/decks/delete-deck'
import type { SavedDeckSummary } from '@/server/application/decks/saved-decks'

/**
 * Excluir uma decklist (decisão 108).
 *
 * A ação é duble: o que se testa aqui é que **nada acontece sem confirmar**, e
 * que o excluir alcança quem não tem Premium. A tradução do formulário está em
 * `tests/unit/delete-deck-action.test.ts`, e a regra de dono em
 * `tests/integration/saved-decks.test.ts`.
 */
const { excluirDeckAction } = vi.hoisted(() => ({ excluirDeckAction: vi.fn() }))
vi.mock('@/app/(app)/deck/actions', () => ({ excluirDeckAction }))

beforeEach(() => {
  excluirDeckAction.mockReset()
})

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

describe('DeleteDeck', () => {
  /* Confirmação obrigatória em ação destrutiva (design-system.md). */
  it('não apaga no primeiro toque: abre a confirmação', async () => {
    const user = userEvent.setup()
    render(<DeleteDeck id="1" name="Koala Pirates Party" />)

    await user.click(screen.getByRole('button', { name: 'Excluir lista' }))

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('Excluir Koala Pirates Party?')).toBeInTheDocument()
    expect(excluirDeckAction).not.toHaveBeenCalled()
  })

  /*
   * O texto diz o que **não** acontece. O do binder promete que as cartas
   * ficam na coleção; aqui a lista some de vez, e dizer o contrário seria
   * mentir — mas a coleção de fato não é tocada, e é isso que tranquiliza.
   */
  it('avisa que não dá para desfazer e que as cartas não são tocadas', async () => {
    const user = userEvent.setup()
    render(<DeleteDeck id="1" name="Koala Pirates Party" />)

    await user.click(screen.getByRole('button', { name: 'Excluir lista' }))

    const dialogo = screen.getByRole('alertdialog')
    expect(dialogo).toHaveTextContent('não dá para desfazer')
    expect(dialogo).toHaveTextContent('Suas cartas não são tocadas')
  })

  /* O padrão de um diálogo destrutivo é não destruir: cancelar fecha e nada é chamado. */
  it('cancelar fecha sem apagar', async () => {
    const user = userEvent.setup()
    render(<DeleteDeck id="1" name="Koala Pirates Party" />)

    await user.click(screen.getByRole('button', { name: 'Excluir lista' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(excluirDeckAction).not.toHaveBeenCalled()
  })

  /* Ícone sozinho precisa de nome acessível, e o nome diz qual lista. */
  it('o botão de ícone da linha diz qual lista ele apaga', () => {
    render(<DeleteDeck id="1" name="Koala Pirates Party" variant="icone" />)

    expect(screen.getByRole('button', { name: 'Excluir Koala Pirates Party' })).toBeInTheDocument()
  })

  /*
   * O motivo de o excluir existir na linha: a tela de detalhe não abre sem
   * Premium, e o caso de uso é explícito em deixar apagar sem Premium. Só no
   * detalhe, quem deixou de assinar ficaria presa a uma lista que não consegue
   * nem abrir nem apagar.
   */
  it('aparece na linha mesmo sem Premium', () => {
    render(<DeckList decks={[deck()]} premium={false} />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Premium para abrir')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excluir Koala Pirates Party' })).toBeInTheDocument()
  })

  it('aparece na linha com Premium, ao lado do link', () => {
    render(<DeckList decks={[deck()]} premium />)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/deck/1')
    expect(screen.getByRole('button', { name: 'Excluir Koala Pirates Party' })).toBeInTheDocument()
  })
})
