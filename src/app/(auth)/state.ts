import type { FormError } from '@/server/http/form-state'

/**
 * O estado dos formularios de conta.
 *
 * Vive fora de `actions.ts` porque um arquivo `'use server'` so pode exportar
 * funcao assincrona: exportar a constante `IDLE` de la faz o Next recusar o
 * modulo em tempo de execucao — e, pior, **o build passa**. O erro so aparece
 * no primeiro envio do formulario.
 */
export type AuthFormState =
  | { status: 'idle' }
  | FormError
  /** Cadastro e redefinicao terminam pedindo para conferir a caixa de entrada. */
  | { status: 'sent'; email: string }

export const IDLE: AuthFormState = { status: 'idle' }
