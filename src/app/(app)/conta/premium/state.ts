import type { FormError } from '@/server/http/form-state'

/**
 * O estado dos botões que levam à Stripe (decisão 102).
 *
 * Só existe o caminho de erro: quando dá certo, a ação redireciona para o
 * provedor e esta tela deixa de existir.
 *
 * Vive fora de `actions.ts` porque um arquivo `'use server'` só pode exportar
 * função assíncrona.
 */
export type CheckoutState = { status: 'idle' } | FormError

export const CHECKOUT_IDLE: CheckoutState = { status: 'idle' }
