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
