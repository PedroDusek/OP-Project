'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { claimTrial, openBillingPortal, startCheckout } from '@/server/application/billing'
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

/**
 * Resgatar os 7 dias de teste (decisão 102, mudança de 21/09).
 *
 * A única ação desta tela que **não** sai do ColeXa: não há provedor, não há
 * cartão, e o acesso entra na hora. Por isso ela revalida a página em vez de
 * redirecionar — a pessoa fica onde está e vê o plano já mudado.
 */
export async function claimTrialAction(_previous: CheckoutState): Promise<CheckoutState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: 'Sua sessão expirou. Entre de novo.', fields: {} }

  try {
    await claimTrial(viewer)
  } catch (error) {
    if (isAppError(error)) return formErrorFrom(error)
    throw error
  }

  // O layout inteiro, e não só esta tela: o Premium destrava menu, dashboard e
  // as travas de troca, que ficariam mostrando o estado velho até um recarregar.
  revalidatePath('/', 'layout')
  return { status: 'idle' }
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
