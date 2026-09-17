/**
 * O estado dos gestos da rede: bloquear, desbloquear e denunciar.
 *
 * Vive fora de `actions.ts` porque um arquivo `'use server'` só pode exportar
 * função assíncrona (armadilha 11).
 */
export type NetworkActionState =
  | { status: 'idle' }
  | { status: 'done'; message: string }
  | { status: 'error'; message: string }

export const NETWORK_ACTION_IDLE: NetworkActionState = { status: 'idle' }
