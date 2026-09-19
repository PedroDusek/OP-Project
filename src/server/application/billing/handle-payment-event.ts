import type { Prisma, PrismaClient } from '@prisma/client'
import {
  extendPremium,
  statusFromStripe,
  type BillingCycle,
  type PaymentMethod,
  type SubscriptionStatus,
} from '@/server/domain/billing/plans'
import type { PaymentEventData } from '@/server/http/payment-provider'

/**
 * O que o provedor avisou vira acesso (decisão 102).
 *
 * Camada: application.
 *
 * **Esta é a única porta que libera Premium pago.** A volta do provedor pela
 * tela não serve: o endereço de sucesso é adivinhável, e quem o abrisse à mão
 * viraria Premium de graça. Aqui o aviso vem assinado, e o dinheiro já entrou.
 *
 * ## Duas vezes o mesmo aviso não pode valer dobrado
 *
 * A Stripe reenvia até receber 200, e reenvia de novo em falha de rede. O
 * `event_id` é único em `payment_events`: a segunda vez colide, e a colisão é
 * o sinal de "já processei" — não um erro. A trava mora no banco porque é onde
 * duas entregas simultâneas se resolvem, e não na memória do processo, que na
 * Fly pode ser outro amanhã.
 */

/** O que fazemos com cada tipo. O resto é guardado e ignorado, de propósito. */
const TRATADOS = new Set([
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
])

export interface EventOutcome {
  /** `true` quando este aviso já tinha sido processado antes. */
  duplicate: boolean
  /** `true` quando o tipo não é um dos que movem o acesso. */
  ignored: boolean
  userId: bigint | null
}

export async function handlePaymentEvent(
  prisma: PrismaClient,
  event: PaymentEventData,
  now: Date = new Date(),
): Promise<EventOutcome> {
  const jaVisto = await prisma.paymentEvent.findUnique({ where: { eventId: event.id } })
  if (jaVisto?.handledAt) {
    // Ja processado. Responder 200 e o que faz a Stripe parar de reenviar.
    return { duplicate: true, ignored: false, userId: null }
  }

  if (jaVisto) {
    // Chegou antes e falhou: a Stripe esta reenviando, e desta vez pode dar
    // certo. A mensagem da falha anterior sai do caminho.
    await prisma.paymentEvent.update({ where: { eventId: event.id }, data: { failure: null } })
  } else {
    try {
      await prisma.paymentEvent.create({
        data: {
          eventId: event.id,
          type: event.type,
          payload: event.payload as Prisma.InputJsonValue,
        },
      })
    } catch {
      // Duas entregas do mesmo aviso ao mesmo tempo: o unico decide qual passa,
      // e a outra para aqui.
      return { duplicate: true, ignored: false, userId: null }
    }
  }

  if (!TRATADOS.has(event.type)) {
    await marcarTratado(prisma, event.id)
    return { duplicate: false, ignored: true, userId: null }
  }

  try {
    const userId = await aplicar(prisma, event, now)
    await marcarTratado(prisma, event.id)
    return { duplicate: false, ignored: false, userId }
  } catch (error) {
    /*
     * A falha fica gravada, e `handled_at` continua nulo.
     *
     * E isso que deixa o reenvio da Stripe ser processado de novo: marcado como
     * tratado, ele seria descartado como duplicado e o pagamento ficaria sem
     * efeito para sempre. A mensagem ajuda a entender o que quebrou sem ter de
     * achar a linha certa no log.
     */
    await prisma.paymentEvent
      .update({
        where: { eventId: event.id },
        data: { failure: (error instanceof Error ? error.message : String(error)).slice(0, 500) },
      })
      .catch(() => {})
    throw error
  }
}

async function marcarTratado(prisma: PrismaClient, eventId: string): Promise<void> {
  await prisma.paymentEvent.update({ where: { eventId }, data: { handledAt: new Date() } })
}

// ------------------------------------------------------------------ aplicar

interface StripeObjeto {
  object?: string
  id?: string
  customer?: string | null
  subscription?: string | null
  mode?: string
  status?: string
  client_reference_id?: string | null
  cancel_at_period_end?: boolean
  current_period_end?: number | null
  metadata?: Record<string, string> | null
  lines?: { data?: { period?: { end?: number | null } | null }[] } | null
}

/** Aplica o aviso e devolve de quem é a conta, quando dá para saber. */
async function aplicar(prisma: PrismaClient, event: PaymentEventData, now: Date): Promise<bigint | null> {
  const objeto = ((event.payload as { data?: { object?: StripeObjeto } }).data?.object ?? {}) as StripeObjeto
  const customerId = typeof objeto.customer === 'string' ? objeto.customer : null

  const userId = await acharUsuario(prisma, objeto, customerId)
  if (!userId) {
    // Sem dono, nada a fazer: um aviso de outra integração da mesma conta
    // Stripe cairia aqui, e derrubar o webhook por causa dele faria a Stripe
    // reenviar para sempre.
    return null
  }

  const cycle = cicloDe(objeto)
  const method: PaymentMethod = objeto.mode === 'payment' ? 'PIX' : 'CARD'

  if (event.type === 'checkout.session.completed') {
    if (objeto.mode === 'payment') {
      // Pix: um ciclo comprado, contado por nos (decisao 102).
      const usuario = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { premiumUntil: true },
      })
      const ate = extendPremium(usuario.premiumUntil, now, cycle)
      await gravar(prisma, {
        userId,
        customerId,
        subscriptionId: null,
        status: 'ACTIVE',
        cycle,
        method: 'PIX',
        currentPeriodEnd: ate,
        cancelAtPeriodEnd: true,
      })
      await liberar(prisma, userId, ate)
      return userId
    }

    // Cartao: a ficha nasce aqui, e o fim do ciclo chega no `invoice.paid`
    // que vem junto. Ate la, o acesso ainda nao foi liberado.
    await gravar(prisma, {
      userId,
      customerId,
      subscriptionId: typeof objeto.subscription === 'string' ? objeto.subscription : null,
      status: 'ACTIVE',
      cycle,
      method: 'CARD',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    })
    return userId
  }

  if (event.type === 'invoice.paid') {
    const fim = fimDoCiclo(objeto)
    await gravar(prisma, {
      userId,
      customerId,
      subscriptionId: typeof objeto.subscription === 'string' ? objeto.subscription : null,
      status: 'ACTIVE',
      cycle,
      method,
      currentPeriodEnd: fim,
      cancelAtPeriodEnd: false,
    })
    if (fim) await liberar(prisma, userId, fim)
    return userId
  }

  if (event.type === 'invoice.payment_failed') {
    // Atraso nao corta na hora: o ciclo ja pago continua valendo (ver o
    // comentario de `SubscriptionStatus`).
    await atualizarStatus(prisma, userId, 'PAST_DUE')
    return userId
  }

  // customer.subscription.updated | deleted
  const status: SubscriptionStatus =
    event.type === 'customer.subscription.deleted'
      ? 'CANCELED'
      : statusFromStripe(objeto.status ?? '')
  const fim = objeto.current_period_end ? new Date(objeto.current_period_end * 1000) : null
  await gravar(prisma, {
    userId,
    customerId,
    subscriptionId: typeof objeto.id === 'string' ? objeto.id : null,
    status,
    cycle,
    method: 'CARD',
    currentPeriodEnd: fim,
    cancelAtPeriodEnd: Boolean(objeto.cancel_at_period_end) || status === 'CANCELED',
  })
  // Cancelar nao tira o acesso do ciclo ja pago: `premium_until` fica onde
  // esta, e a conta cai sozinha quando a data chegar.
  if (status === 'ACTIVE' && fim) await liberar(prisma, userId, fim)
  return userId
}

function cicloDe(objeto: StripeObjeto): BillingCycle {
  return objeto.metadata?.cycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY'
}

/** O fim do período pago vem na linha da fatura. */
function fimDoCiclo(objeto: StripeObjeto): Date | null {
  const fim = objeto.lines?.data?.[0]?.period?.end ?? objeto.current_period_end ?? null
  return fim ? new Date(fim * 1000) : null
}

/**
 * De quem é o pagamento.
 *
 * Pela ordem: o identificador que mandamos na sessão, o que gravamos no
 * assinante, e por fim o cliente já conhecido. **Nunca pelo e-mail**, que a
 * pessoa digita no provedor e pode ser o de outra conta.
 */
async function acharUsuario(
  prisma: PrismaClient,
  objeto: StripeObjeto,
  customerId: string | null,
): Promise<bigint | null> {
  const doAviso = objeto.client_reference_id ?? objeto.metadata?.user_id ?? null
  if (doAviso && /^\d+$/.test(doAviso)) {
    const existe = await prisma.user.findUnique({ where: { id: BigInt(doAviso) }, select: { id: true } })
    if (existe) return existe.id
  }

  if (customerId) {
    const assinatura = await prisma.subscription.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: { userId: true },
    })
    if (assinatura) return assinatura.userId
  }

  return null
}

interface Ficha {
  userId: bigint
  customerId: string | null
  subscriptionId: string | null
  status: SubscriptionStatus
  cycle: BillingCycle
  method: PaymentMethod
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
}

/** Uma ficha por assinatura: a do provedor quando há, a última da pessoa quando não. */
async function gravar(prisma: PrismaClient, ficha: Ficha): Promise<void> {
  const existente = await prisma.subscription.findFirst({
    where: ficha.subscriptionId
      ? { subscriptionId: ficha.subscriptionId }
      : { userId: ficha.userId, subscriptionId: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, customerId: true },
  })

  const dados = {
    status: ficha.status,
    cycle: ficha.cycle,
    method: ficha.method,
    cancelAtPeriodEnd: ficha.cancelAtPeriodEnd,
    ...(ficha.currentPeriodEnd ? { currentPeriodEnd: ficha.currentPeriodEnd } : {}),
    ...(ficha.customerId ? { customerId: ficha.customerId } : {}),
    ...(ficha.subscriptionId ? { subscriptionId: ficha.subscriptionId } : {}),
  }

  if (existente) {
    await prisma.subscription.update({ where: { id: existente.id }, data: dados })
    return
  }

  await prisma.subscription.create({
    data: {
      userId: ficha.userId,
      customerId: ficha.customerId ?? '',
      subscriptionId: ficha.subscriptionId,
      status: ficha.status,
      cycle: ficha.cycle,
      method: ficha.method,
      currentPeriodEnd: ficha.currentPeriodEnd,
      cancelAtPeriodEnd: ficha.cancelAtPeriodEnd,
    },
  })
}

async function atualizarStatus(prisma: PrismaClient, userId: bigint, status: SubscriptionStatus): Promise<void> {
  const atual = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  if (atual) await prisma.subscription.update({ where: { id: atual.id }, data: { status } })
}

/**
 * Libera o acesso até a data.
 *
 * Nunca encurta o que já existe: quem tinha cortesia até 2046 e resolveu
 * assinar não pode sair perdendo por causa disso (é o caso do dono do produto).
 */
async function liberar(prisma: PrismaClient, userId: bigint, ate: Date): Promise<void> {
  const usuario = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { premiumUntil: true },
  })
  const premiumUntil = usuario.premiumUntil && usuario.premiumUntil > ate ? usuario.premiumUntil : ate
  await prisma.user.update({ where: { id: userId }, data: { plan: 'PREMIUM', premiumUntil } })
}
