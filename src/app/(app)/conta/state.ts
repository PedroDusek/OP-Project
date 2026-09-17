import type { FormError } from '@/server/http/form-state'

/**
 * O estado do formulario de nome de usuario.
 *
 * Vive fora de `actions.ts` porque um arquivo `'use server'` so pode exportar
 * funcao assincrona: exportar uma constante de la passa no build e quebra no
 * primeiro envio.
 */
export type UsernameState =
  | { status: 'idle' }
  | { status: 'saved'; username: string }
  | FormError

export const USERNAME_IDLE: UsernameState = { status: 'idle' }

/** O formulario de excluir a conta (decisao 091). Quando da certo, a acao redireciona. */
export type DeletionState = { status: 'idle' } | FormError

export const DELETION_IDLE: DeletionState = { status: 'idle' }
