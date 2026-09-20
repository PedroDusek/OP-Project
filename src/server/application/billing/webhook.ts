import { prisma } from '@/server/infrastructure/prisma'
import { StripePaymentProvider } from '@/server/infrastructure/payments/stripe-payment-provider'
import { handlePaymentEvent, type EventOutcome } from './handle-payment-event'

/**
 * O webhook, montado (decisão 102).
 *
 * Camada: application — a única que pode falar com infrastructure. A rota em
 * `app/` chama daqui, e assim ela não precisa conhecer nem a Stripe nem o
 * Prisma. É a mesma fronteira que o lint do projeto impõe ao resto das telas.
 */

const provider = new StripePaymentProvider()

/** `false` quando as chaves não estão configuradas neste ambiente. */
export function paymentsConfigured(): boolean {
  return provider.available
}

export class InvalidPaymentSignature extends Error {}

/**
 * Confere a assinatura e processa. O corpo é o **texto cru**: reserializar o
 * JSON muda um espaço e a assinatura deixa de conferir.
 */
export async function processPaymentWebhook(
  rawBody: string,
  signature: string | null,
): Promise<EventOutcome & { type: string; eventId: string }> {
  let event
  try {
    event = provider.parseEvent(rawBody, signature)
  } catch (error) {
    throw new InvalidPaymentSignature(error instanceof Error ? error.message : String(error))
  }

  const outcome = await handlePaymentEvent(prisma, event)
  return { ...outcome, type: event.type, eventId: event.id }
}
