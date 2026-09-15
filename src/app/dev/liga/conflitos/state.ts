/**
 * O estado do formulário de um conflito.
 *
 * Vive fora de `actions.ts` porque um arquivo `'use server'` só pode exportar
 * função assíncrona (armadilha 11).
 */
export type ConflictAnswerState =
  | { status: 'idle' }
  | { status: 'saved'; produto: string | null }
  | { status: 'error'; message: string }

export const CONFLICT_ANSWER_IDLE: ConflictAnswerState = { status: 'idle' }

/** O valor de "nenhum destes": a arte fica sem preço, de propósito. */
export const NENHUM_PRODUTO = 'nenhum'
