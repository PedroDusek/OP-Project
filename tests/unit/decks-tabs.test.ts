import { describe, expect, it } from 'vitest'
import { DECKS_TABS, DEFAULT_DECKS_TAB, parseDecksTab } from '@/lib/decks-tabs'

/**
 * As duas gavetas de Decks (decisão 111).
 *
 * A leitura mora fora do componente porque a página — que é servidor — precisa
 * dela para decidir o que renderizar, e o componente precisa dela para marcar a
 * aba ativa. Duas cópias divergiriam na primeira aba nova.
 */
describe('as abas de Decks', () => {
  it('sao duas, e a deckbox vem primeiro', () => {
    // A ordem e o pedido do dono do produto, e o motivo do remanejamento:
    // usuarios nao achavam a deckbox.
    expect(DECKS_TABS).toEqual(['deckbox', 'decklist'])
    expect(DEFAULT_DECKS_TAB).toBe('deckbox')
  })

  it('le a aba escolhida', () => {
    expect(parseDecksTab('decklist')).toBe('decklist')
    expect(parseDecksTab('DECKLIST')).toBe('decklist')
    expect(parseDecksTab(' deckbox ')).toBe('deckbox')
  })

  /* URL editada a mao nao deve abrir uma aba que nao existe. */
  it('o que nao e uma aba conhecida vira a padrao', () => {
    expect(parseDecksTab('binder')).toBe('deckbox')
    expect(parseDecksTab('')).toBe('deckbox')
    expect(parseDecksTab(null)).toBe('deckbox')
    expect(parseDecksTab(undefined)).toBe('deckbox')
  })
})
