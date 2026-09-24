/**
 * O estado do formulário de uma arte na tabela de sets do DON!!.
 *
 * Vive fora de `actions.ts` porque um arquivo `'use server'` só pode exportar
 * função assíncrona (armadilha 11).
 */
export type DonSetsState =
  | { status: 'idle' }
  | { status: 'saved'; sets: string[] }
  | { status: 'error'; message: string }

export const DON_SETS_IDLE: DonSetsState = { status: 'idle' }
