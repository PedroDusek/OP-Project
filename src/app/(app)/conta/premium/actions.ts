'use server'

import { redirect } from 'next/navigation'
import { openBillingPortal, startCheckout } from '@/server/application/billing'
import type { BillingCycle, PaymentMethod } from '@/server/domain/billing/plans'
import { isAppError } from '@/server/domain/errors'
import { formErrorFrom } from '@/server/http/form-state'
import { currentViewer } from '@/server/http/viewer'
import type { CheckoutState } from './state'

/**
 * Levar à Stripe (decisão 102).
 *
 * Camada: `app`. Fina: lê a sessão, chama **um** caso de uso e redireciona.
 * Nenhum acesso é liberado aqui — quem libera é o webhook, depois que o
 * dinheiro entra.
 *
 * O `redirect` fica **fora** do try: ele funciona lançando uma exceção que o
 * Next entende, e um `catch` em volta a trataria como falha.
 */
export async function startCheckoutAction(
  _previous: CheckoutState,
  data: FormData,
): Promise<CheckoutState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: 'Sua sessão expirou. Entre de novo.', fields: {} }

  let destino: string
  try {
    destino = await startCheckout(viewer, {
      cycle: String(data.get('ciclo') ?? '') as BillingCycle,
      method: String(data.get('forma') ?? '') as PaymentMethod,
    })
  } catch (error) {
    if (isAppError(error)) return formErrorFrom(error)
    throw error
  }

  redirect(destino)
}

/** Abrir o portal da Stripe, onde a pessoa troca o cartão ou cancela. */
export async function openPortalAction(_previous: CheckoutState): Promise<CheckoutState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: 'Sua sessão expirou. Entre de novo.', fields: {} }

  let destino: string
  try {
    destino = await openBillingPortal(viewer)
  } catch (error) {
    if (isAppError(error)) return formErrorFrom(error)
    throw error
  }

  redirect(destino)
}
