import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { AuthenticatedUser } from '@/server/application/auth'
import { handlePaymentEvent } from '@/server/application/billing/handle-payment-event'
import { readBilling, startCheckout } from '@/server/application/billing/subscribe'
import { ValidationError } from '@/server/domain/errors'
import type { CheckoutRequest, PaymentProvider } from '@/server/http/payment-provider'
import { createUser, disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * O pagamento virando acesso (decisão 102).
 *
 * O que se protege: só o aviso assinado libera Premium, o mesmo aviso não vale
 * duas vezes, atraso e cancelamento não cortam o ciclo já pago, e o Pix conta o
 * período do nosso lado.
 */

const AGORA = new Date('2026-10-15T12:00:00Z')

let pedidos: CheckoutRequest[] = []
const provider: PaymentProvider = {
  name: 'falso',
  available: true,
  createCheckout: async (request) => {
    pedidos.push(request)
    return { url: 'https://stripe.test/pagar', sessionId: 'cs_1' }
  },
  createPortalSession: async () => 'https://stripe.test/portal',
  parseEvent: () => {
    throw new Error('não usado aqui')
  },
}

async function pessoa(premiumUntil: Date | null = null): Promise<AuthenticatedUser> {
  const criada = await createUser('Assinante')
  if (premiumUntil) {
    await testPrisma().user.update({
      where: { id: criada.id },
      data: { plan: 'PREMIUM', premiumUntil },
    })
  }
  return {
    id: criada.id,
    email: criada.email,
    name: 'Assinante',
    plan: premiumUntil ? 'PREMIUM' : 'FREE',
    premiumUntil,
  }
}

/** O envelope que a Stripe manda, no formato que o caso de uso lê. */
function aviso(type: string, object: Record<string, unknown>, id = `evt_${Math.random()}`) {
  return { id, type, payload: { id, type, data: { object } } }
}

const usuarioDo = async (user: AuthenticatedUser) =>
  testPrisma().user.findUniqueOrThrow({ where: { id: user.id } })

beforeEach(async () => {
  await resetDatabase()
  pedidos = []
})

afterAll(async () => {
  await disconnect()
})

describe('startCheckout', () => {
  it('manda o identificador da pessoa, e não o e-mail, para a volta', async () => {
    const ana = await pessoa()

    const url = await startCheckout(testPrisma(), provider, ana, {
      cycle: 'ANNUAL',
      method: 'CARD',
      appUrl: 'https://colexa.test',
    })

    expect(url).toBe('https://stripe.test/pagar')
    expect(pedidos[0]).toMatchObject({ userId: String(ana.id), cycle: 'ANNUAL', customerId: null })
  })

  it('recusa plano inválido', async () => {
    const ana = await pessoa()

    await expect(
      startCheckout(testPrisma(), provider, ana, {
        cycle: 'SEMANAL' as never,
        method: 'CARD',
        appUrl: 'https://colexa.test',
      }),
    ).rejects.toThrow(ValidationError)
  })

  /* Sem chaves configuradas, a tela não oferece pagamento — e o caso de uso
     também não, para uma chamada direta não criar sessão. */
  it('recusa quando o provedor não está configurado', async () => {
    const ana = await pessoa()

    await expect(
      startCheckout(testPrisma(), { ...provider, available: false }, ana, {
        cycle: 'MONTHLY',
        method: 'PIX',
        appUrl: 'https://colexa.test',
      }),
    ).rejects.toThrow(ValidationError)
  })

  it('reusa o cliente de quem já pagou antes', async () => {
    const ana = await pessoa()
    await testPrisma().subscription.create({
      data: { userId: ana.id, customerId: 'cus_ana', status: 'CANCELED', cycle: 'MONTHLY', method: 'CARD' },
    })

    await startCheckout(testPrisma(), provider, ana, {
      cycle: 'MONTHLY',
      method: 'CARD',
      appUrl: 'https://colexa.test',
    })

    expect(pedidos[0].customerId).toBe('cus_ana')
  })
})

describe('o cartão', () => {
  it('libera o Premium quando a fatura é paga, e não na volta da tela', async () => {
    const ana = await pessoa()
    const fim = new Date('2026-11-15T12:00:00Z')

    await handlePaymentEvent(
      testPrisma(),
      aviso('checkout.session.completed', {
        mode: 'subscription',
        customer: 'cus_ana',
        subscription: 'sub_ana',
        client_reference_id: String(ana.id),
        metadata: { cycle: 'MONTHLY' },
      }),
      AGORA,
    )

    // Só a sessão não libera: o dinheiro ainda não entrou.
    expect((await usuarioDo(ana)).plan).toBe('FREE')

    await handlePaymentEvent(
      testPrisma(),
      aviso('invoice.paid', {
        customer: 'cus_ana',
        subscription: 'sub_ana',
        metadata: { cycle: 'MONTHLY' },
        lines: { data: [{ period: { end: Math.floor(fim.getTime() / 1000) } }] },
      }),
      AGORA,
    )

    const depois = await usuarioDo(ana)
    expect(depois.plan).toBe('PREMIUM')
    expect(depois.premiumUntil).toEqual(fim)
    const assinatura = await testPrisma().subscription.findFirstOrThrow({ where: { userId: ana.id } })
    expect(assinatura).toMatchObject({ status: 'ACTIVE', method: 'CARD', subscriptionId: 'sub_ana' })
  })

  /* A Stripe reenvia até receber 200. Duas vezes não pode valer dobrado. */
  it('o mesmo aviso não conta duas vezes', async () => {
    const ana = await pessoa()
    const fim = new Date('2026-11-15T12:00:00Z')
    const pago = aviso('invoice.paid', {
      customer: 'cus_ana',
      subscription: 'sub_ana',
      client_reference_id: String(ana.id),
      metadata: { cycle: 'MONTHLY' },
      lines: { data: [{ period: { end: Math.floor(fim.getTime() / 1000) } }] },
    })

    const primeira = await handlePaymentEvent(testPrisma(), pago, AGORA)
    const segunda = await handlePaymentEvent(testPrisma(), pago, AGORA)

    expect(primeira.duplicate).toBe(false)
    expect(segunda.duplicate).toBe(true)
    expect((await usuarioDo(ana)).premiumUntil).toEqual(fim)
    expect(await testPrisma().paymentEvent.count()).toBe(1)
  })

  /* Atraso não corta na hora: o ciclo já pago continua valendo. */
  it('fatura que não passa marca atraso e mantém o acesso do ciclo', async () => {
    const fim = new Date('2026-11-15T12:00:00Z')
    const ana = await pessoa(fim)
    await testPrisma().subscription.create({
      data: {
        userId: ana.id,
        customerId: 'cus_ana',
        subscriptionId: 'sub_ana',
        status: 'ACTIVE',
        cycle: 'MONTHLY',
        method: 'CARD',
        currentPeriodEnd: fim,
      },
    })

    await handlePaymentEvent(
      testPrisma(),
      aviso('invoice.payment_failed', { customer: 'cus_ana', subscription: 'sub_ana' }),
      AGORA,
    )

    expect((await testPrisma().subscription.findFirstOrThrow({ where: { userId: ana.id } })).status).toBe(
      'PAST_DUE',
    )
    const depois = await usuarioDo(ana)
    expect(depois.plan).toBe('PREMIUM')
    expect(depois.premiumUntil).toEqual(fim)
  })

  /* Cancelar no meio do mês não devolve dinheiro nem tira o acesso na hora. */
  it('cancelamento mantém o acesso até o fim do ciclo pago', async () => {
    const fim = new Date('2026-11-15T12:00:00Z')
    const ana = await pessoa(fim)
    await testPrisma().subscription.create({
      data: {
        userId: ana.id,
        customerId: 'cus_ana',
        subscriptionId: 'sub_ana',
        status: 'ACTIVE',
        cycle: 'MONTHLY',
        method: 'CARD',
        currentPeriodEnd: fim,
      },
    })

    await handlePaymentEvent(
      testPrisma(),
      aviso('customer.subscription.deleted', {
        id: 'sub_ana',
        customer: 'cus_ana',
        status: 'canceled',
        current_period_end: Math.floor(fim.getTime() / 1000),
      }),
      AGORA,
    )

    const assinatura = await testPrisma().subscription.findFirstOrThrow({ where: { userId: ana.id } })
    expect(assinatura).toMatchObject({ status: 'CANCELED', cancelAtPeriodEnd: true })
    expect((await usuarioDo(ana)).premiumUntil).toEqual(fim)
  })
})

describe('o Pix', () => {
  /* Não há assinatura do lado de lá: o período é contado por nós. */
  it('um pagamento compra um ciclo, contado daqui', async () => {
    const ana = await pessoa()

    await handlePaymentEvent(
      testPrisma(),
      aviso('checkout.session.completed', {
        mode: 'payment',
        customer: 'cus_ana',
        client_reference_id: String(ana.id),
        metadata: { cycle: 'ANNUAL' },
      }),
      AGORA,
    )

    const depois = await usuarioDo(ana)
    expect(depois.plan).toBe('PREMIUM')
    expect(depois.premiumUntil).toEqual(new Date('2027-10-15T12:00:00Z'))
    const assinatura = await testPrisma().subscription.findFirstOrThrow({ where: { userId: ana.id } })
    expect(assinatura).toMatchObject({ method: 'PIX', subscriptionId: null, cancelAtPeriodEnd: true })
  })

  it('pagar antes de vencer emenda no que já existe', async () => {
    const ate = new Date('2026-11-01T12:00:00Z')
    const ana = await pessoa(ate)

    await handlePaymentEvent(
      testPrisma(),
      aviso('checkout.session.completed', {
        mode: 'payment',
        customer: 'cus_ana',
        client_reference_id: String(ana.id),
        metadata: { cycle: 'MONTHLY' },
      }),
      AGORA,
    )

    expect((await usuarioDo(ana)).premiumUntil).toEqual(new Date('2026-12-01T12:00:00Z'))
  })
})

describe('a cortesia', () => {
  /*
   * O dono do produto tem Premium até 2046 (cortesia). Assinar não pode
   * encurtar isso — seria pagar para perder acesso.
   */
  it('nunca encurta um Premium mais longo que o ciclo pago', async () => {
    const longe = new Date('2046-09-19T23:59:59Z')
    const ana = await pessoa(longe)

    await handlePaymentEvent(
      testPrisma(),
      aviso('invoice.paid', {
        customer: 'cus_ana',
        subscription: 'sub_ana',
        client_reference_id: String(ana.id),
        metadata: { cycle: 'MONTHLY' },
        lines: { data: [{ period: { end: Math.floor(new Date('2026-11-15T12:00:00Z').getTime() / 1000) } }] },
      }),
      AGORA,
    )

    expect((await usuarioDo(ana)).premiumUntil).toEqual(longe)
  })
})

describe('avisos que não são nossos', () => {
  it('tipo que não movemos é guardado e ignorado', async () => {
    const outcome = await handlePaymentEvent(
      testPrisma(),
      aviso('customer.created', { id: 'cus_x' }),
      AGORA,
    )

    expect(outcome).toMatchObject({ ignored: true, duplicate: false })
    expect(await testPrisma().paymentEvent.count()).toBe(1)
  })

  /* Aviso de outra integração da mesma conta Stripe: sem dono, nada a fazer —
     e derrubar o webhook faria a Stripe reenviar para sempre. */
  it('pagamento sem dono conhecido não derruba nada', async () => {
    const outcome = await handlePaymentEvent(
      testPrisma(),
      aviso('invoice.paid', { customer: 'cus_desconhecido', subscription: 'sub_x' }),
      AGORA,
    )

    expect(outcome.userId).toBeNull()
    expect(await testPrisma().subscription.count()).toBe(0)
  })

  /* Falha deixa rastro e **não** marca como tratado: o reenvio precisa poder
     ser processado, senão o pagamento fica sem efeito para sempre. */
  it('falha fica gravada, e o reenvio processa de novo', async () => {
    const ana = await pessoa()
    const fim = new Date('2026-11-15T12:00:00Z')
    const pago = aviso('invoice.paid', {
      customer: 'cus_ana',
      subscription: 'sub_ana',
      client_reference_id: String(ana.id),
      metadata: { cycle: 'MONTHLY' },
      lines: { data: [{ period: { end: Math.floor(fim.getTime() / 1000) } }] },
    })

    // Um cliente com `user.update` quebrado: os modelos do Prisma são getters,
    // e um espião neles não pega. O resto passa direto para o cliente de verdade.
    const comBancoFora = new Proxy(testPrisma(), {
      get(alvo, campo) {
        if (campo !== 'user') return Reflect.get(alvo, campo)
        return new Proxy(alvo.user, {
          get: (modelo, metodo) =>
            metodo === 'update'
              ? () => Promise.reject(new Error('banco fora do ar'))
              : Reflect.get(modelo, metodo),
        })
      },
    })
    await expect(handlePaymentEvent(comBancoFora, pago, AGORA)).rejects.toThrow('banco fora do ar')

    const gravado = await testPrisma().paymentEvent.findUniqueOrThrow({ where: { eventId: pago.id } })
    expect(gravado.handledAt).toBeNull()
    expect(gravado.failure).toContain('banco fora do ar')

    const segunda = await handlePaymentEvent(testPrisma(), pago, AGORA)
    expect(segunda.duplicate).toBe(false)
    expect((await usuarioDo(ana)).premiumUntil).toEqual(fim)
  })
})

describe('readBilling', () => {
  it('mostra a assinatura de quem tem, e nada para quem nunca pagou', async () => {
    const semPagar = await pessoa()
    expect(await readBilling(testPrisma(), provider, semPagar, AGORA)).toMatchObject({
      premium: false,
      subscription: null,
      available: true,
    })

    const fim = new Date('2026-11-15T12:00:00Z')
    const ana = await pessoa(fim)
    await testPrisma().subscription.create({
      data: {
        userId: ana.id,
        customerId: 'cus_ana',
        status: 'ACTIVE',
        cycle: 'ANNUAL',
        method: 'CARD',
        currentPeriodEnd: fim,
      },
    })

    expect(await readBilling(testPrisma(), provider, ana, AGORA)).toMatchObject({
      premium: true,
      subscription: { status: 'ACTIVE', cycle: 'ANNUAL', method: 'CARD' },
    })
  })
})
