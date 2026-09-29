/**
 * As duas gavetas da tela de Decks (decisão 111).
 *
 * Fica fora do componente porque a página — que é servidor — precisa da mesma
 * leitura para decidir o que renderizar, e duas cópias da regra divergiriam na
 * primeira aba nova.
 *
 * `deckbox` é a primeira e a padrão. O remanejamento nasceu de usuários que não
 * achavam a deckbox; abrir em Decklists deixaria a gaveta que motivou a mudança
 * escondida atrás de um toque, que é o defeito de novo.
 */
export const DECKS_TABS = ['deckbox', 'decklist'] as const
export type DecksTab = (typeof DECKS_TABS)[number]

export const DEFAULT_DECKS_TAB: DecksTab = 'deckbox'

/** O que não for uma aba conhecida vira a padrão. */
export function parseDecksTab(raw: string | null | undefined): DecksTab {
  const value = raw?.trim().toLowerCase()
  return DECKS_TABS.find((tab) => tab === value) ?? DEFAULT_DECKS_TAB
}
