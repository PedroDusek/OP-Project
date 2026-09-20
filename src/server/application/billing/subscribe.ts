import type { PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { isPremium } from '@/server/application/authorization'
import {
  PLANS,
  type BillingCycle,
  type PaymentMethod,
  type SubscriptionStatus,
} from '@/server/domain/billing/plans'
import { ValidationError } from '@/server/domain/errors'
import type { PaymentProvider } from '@/server/http/payment-provider'

/**
 * Assinar o Premium e gerenciar a assinatura (decisão 102).
 *
 * Camada: application.
 *
 * O que esta camada **não** faz é liberar acesso: quem faz isso é o webhook,
 * depois que o dinheiro entrou (`handle-payment-event.ts`). Aqui só se cria a
 * sessão de pagamento e se lê o estado — uma volta do provedor pela tela nunca
 * vira Premium, senão bastaria abrir o endereço de sucesso à mão.
 */

export interface BillingView {
  /** O acesso de hoje, que pode vir de cortesia e não de pagamento. */
  premium: boolean
  premiumUntil: Date | null
  /** Nulo para quem nunca pagou: o Premium de hoje, se houver, é cortesia. */
  subscription: {
    status: SubscriptionStatus
    cycle: BillingCycle
    method: PaymentMethod
    currentPeriodEnd: Date | null
    cancelAtPeriodEnd: boolean
  } | null
  /** `false` quando as chaves do provedor não estão configuradas. */
  available: boolean
}

export async function readBilling(
  prisma: PrismaClient,
  provider: PaymentProvider,
  user: AuthenticatedUser,
  now: Date = new Date(),
): Promise<BillingView> {
  const assinatura = await assinaturaAtual(prisma, user.id)

  return {
    premium: isPremium(user, now),
    premiumUntil: user.premiumUntil,
    subscription: assinatura
      ? {
          status: assinatura.status as SubscriptionStatus,
          cycle: assinatura.cycle as BillingCycle,
          method: assinatura.method as PaymentMethod,
          currentPeriodEnd: assinatura.currentPeriodEnd,
          cancelAtPeriodEnd: assinatura.cancelAtPeriodEnd,
        }
      : null,
    available: provider.available,
  }
}

export interface CheckoutInput {
  cycle: BillingCycle
  method: PaymentMethod
  appUrl: string
}

/** Cria a sessão de pagamento e devolve para onde mandar a pessoa. */
export async function startCheckout(
  prisma: PrismaClient,
  provider: PaymentProvider,
  user: AuthenticatedUser,
  input: CheckoutInput,
): Promise<string> {
  if (!PLANS[input.cycle]) throw new ValidationError('Escolha um plano válido.')
  if (input.method !== 'CARD' && input.method !== 'PIX') {
    throw new ValidationError('Escolha uma forma de pagamento válida.')
  }
  if (!provider.available) {
    throw new ValidationError('O pagamento ainda não está disponível.')
  }

  // Cliente de um pagamento anterior, quando houver: sem isso a mesma pessoa
  // vira duas fichas no provedor, e o portal mostraria metade do histórico.
  const anterior = await assinaturaAtual(prisma, user.id)

  const session = await provider.createCheckout({
    cycle: input.cycle,
    method: input.method,
    userId: String(user.id),
    email: user.email,
    customerId: anterior?.customerId ?? null,
    successUrl: `${input.appUrl}/conta/premium?pago=1`,
    cancelUrl: `${input.appUrl}/conta/premium`,
  })

  return session.url
}

/**
 * O portal do provedor, onde a pessoa troca o cartão ou cancela.
 *
 * Cancelar, trocar cartão e ver recibo são telas que o provedor já mantém, em
 * português, e que precisam estar certas para a cobrança ser legítima.
 * Refazê-las aqui seria copiar responsabilidade sem ganhar nada.
 */
export async function openBillingPortal(
  prisma: PrismaClient,
  provider: PaymentProvider,
  user: AuthenticatedUser,
  appUrl: string,
): Promise<string> {
  const assinatura = await assinaturaAtual(prisma, user.id)
  if (!assinatura) throw new ValidationError('Esta conta não tem assinatura para gerenciar.')

  return provider.createPortalSession(assinatura.customerId, `${appUrl}/conta/premium`)
}

/** A assinatura mais recente da pessoa, paga ou cancelada. */
function assinaturaAtual(prisma: PrismaClient, userId: bigint) {
  return prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
}
