import { prisma } from '@/server/infrastructure/prisma'
import { StripePaymentProvider } from '@/server/infrastructure/payments/stripe-payment-provider'
import { appUrl } from '@/server/http/app-url'
import type { AuthenticatedUser } from '@/server/application/auth'
import {
  openBillingPortal as openBillingPortalWith,
  readBilling as readBillingWith,
  startCheckout as startCheckoutWith,
  type CheckoutInput,
} from './subscribe'

/**
 * Ponto de composição da cobrança (decisão 102).
 *
 * Camada: application, a única que pode falar com infrastructure.
 *
 * `handlePaymentEvent` não está aqui de propósito: ele só roda pela rota do
 * webhook, que já compõe o provedor para conferir a assinatura do aviso.
 */

const provider = new StripePaymentProvider()

export function readBilling(user: AuthenticatedUser) {
  return readBillingWith(prisma, provider, user)
}

export function startCheckout(user: AuthenticatedUser, input: Omit<CheckoutInput, 'appUrl'>) {
  return startCheckoutWith(prisma, provider, user, { ...input, appUrl: appUrl() })
}

export function openBillingPortal(user: AuthenticatedUser) {
  return openBillingPortalWith(prisma, provider, user, appUrl())
}

export type { BillingView } from './subscribe'
