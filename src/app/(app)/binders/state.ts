import type { FormError } from '@/server/http/form-state'

/**
 * O estado dos formulários de binder, caixa e deck.
 *
 * Vive fora de `actions.ts` porque um arquivo `'use server'` só pode exportar
 * função assíncrona: exportar uma constante de lá **passa no build** e quebra no
 * primeiro envio.
 */

export type LocationFormState = { status: 'idle' } | FormError

export const LOCATION_IDLE: LocationFormState = { status: 'idle' }

/**
 * O nome do local nao volta do servidor: quem abriu o painel ja o tem em maos, e
 * devolver o nome obrigaria o formulario a manda-lo — um campo de texto que o
 * cliente escolhe e que nada confere. O id basta, e e ele que e conferido
 * contra o dono.
 */
export type AllocationState =
  | { status: 'idle' }
  | { status: 'saved'; quantity: number; storageLocationId: string }
  | { status: 'error'; message: string }

export const ALLOCATION_IDLE: AllocationState = { status: 'idle' }

export type MoveState =
  | { status: 'idle' }
  | { status: 'moved'; copies: number; toStorageLocationId: string }
  | { status: 'error'; message: string }

export const MOVE_IDLE: MoveState = { status: 'idle' }

export type BulkAddState =
  | { status: 'idle' }
  | { status: 'added'; cards: number; copies: number }
  | { status: 'error'; message: string }

export const BULK_ADD_IDLE: BulkAddState = { status: 'idle' }

/**
 * O estado do "Adicionar ST" (decisao 117).
 *
 * Separado do `BulkAddState` porque diz tambem **quantas vezes** o deck entrou,
 * que e o que a pessoa escolheu e precisa ver confirmado.
 */
export type AddStarterDeckState =
  | { status: 'idle' }
  | { status: 'added'; cards: number; copies: number; times: number; deck: string }
  | { status: 'error'; message: string }

export const ADD_STARTER_DECK_IDLE: AddStarterDeckState = { status: 'idle' }
