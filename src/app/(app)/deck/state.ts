import type { FormError } from '@/server/http/form-state'

/**
 * O estado dos formulários de decklist.
 *
 * Vive fora de `actions.ts` porque um arquivo `'use server'` só pode exportar
 * função assíncrona: exportar uma constante de lá **passa no build** e quebra no
 * primeiro envio. É o mesmo motivo de `binders/state.ts`.
 */

export type DeckDeleteState = { status: 'idle' } | FormError

export const DECK_DELETE_IDLE: DeckDeleteState = { status: 'idle' }
