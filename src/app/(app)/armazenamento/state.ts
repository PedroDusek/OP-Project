import type { FormError } from '@/server/http/form-state'

/**
 * O estado dos formulários de armazenamento.
 *
 * Vive fora de `actions.ts` porque um arquivo `'use server'` só pode exportar
 * função assíncrona: exportar uma constante de lá **passa no build** e quebra no
 * primeiro envio.
 */

export type LocationFormState = { status: 'idle' } | FormError

export const LOCATION_IDLE: LocationFormState = { status: 'idle' }

export type AllocationState =
  | { status: 'idle' }
  | { status: 'saved'; quantity: number; storageLocationId: string; locationName: string }
  | { status: 'error'; message: string }

export const ALLOCATION_IDLE: AllocationState = { status: 'idle' }
