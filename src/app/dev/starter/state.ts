/**
 * O estado do formulário de um starter deck.
 *
 * Vive fora de `actions.ts` porque um arquivo `'use server'` só pode exportar
 * função assíncrona (armadilha 11).
 */
export type StarterDeckState =
  | { status: 'idle' }
  | { status: 'saved'; deck: string; total: number }
  | { status: 'error'; message: string }

export const STARTER_DECK_IDLE: StarterDeckState = { status: 'idle' }
