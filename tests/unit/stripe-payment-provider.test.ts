import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PLANS } from '@/server/domain/billing/plans'
import { StripePaymentProvider } from '@/server/infrastructure/payments/stripe-payment-provider'

/**
 * A conversa com a Stripe (decisão 102), sem rede.
 *
 * O que se protege aqui é o que não dá para ver num teste de banco: a
 * conferência da assinatura do aviso — que é o que impede alguém de virar
 * Premium mandando um POST — e o formato das duas sessões de pagamento, que
 * são diferentes no cartão e no Pix.
 */

const SEGREDO = 'whsec_teste'

function assinar(corpo: string, quando = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac('sha256', SEGREDO).update(`${quando}.${corpo}`).digest('hex')
  return `t=${quando},v1=${v1}`
}

beforeEach(() => {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_teste')
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', SEGREDO)
  vi.stubEnv('STRIPE_PRICE_MONTHLY', 'price_mensal')
  vi.stubEnv('STRIPE_PRICE_ANNUAL', 'price_anual')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('parseEvent', () => {
  const corpo = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' })

  it('aceita o aviso assinado com o nosso segredo', () => {
    const evento = new StripePaymentProvider().parseEvent(corpo, assinar(corpo))

    expect(evento).toMatchObject({ id: 'evt_1', type: 'invoice.paid' })
  })

  /* Sem isto, virar Premium seria um POST com o corpo certo. */
  it('recusa assinatura de outro segredo', () => {
    const forjada = `t=${Math.floor(Date.now() / 1000)},v1=${createHmac('sha256', 'outro').update('x').digest('hex')}`

    expect(() => new StripePaymentProvider().parseEvent(corpo, forjada)).toThrow(/não confere/i)
  })

  it('recusa aviso sem assinatura', () => {
    expect(() => new StripePaymentProvider().parseEvent(corpo, null)).toThrow(/sem assinatura/i)
  })

  /* Aviso legítimo capturado hoje não pode ser reenviado amanhã. */
  it('recusa assinatura velha', () => {
    const ontem = Math.floor(Date.now() / 1000) - 24 * 60 * 60

    expect(() => new StripePaymentProvider().parseEvent(corpo, assinar(corpo, ontem))).toThrow(
      /cinco minutos/i,
    )
  })

  /* O corpo precisa ser o texto cru: reserializar muda um espaço e derruba. */
  it('recusa quando o corpo mudou depois de assinado', () => {
    const assinatura = assinar(corpo)
    const outro = JSON.stringify(JSON.parse(corpo))
      .replace('evt_1', 'evt_2')

    expect(() => new StripePaymentProvider().parseEvent(outro, assinatura)).toThrow(/não confere/i)
  })
})

describe('createCheckout', () => {
  function capturar(resposta: unknown = { id: 'cs_1', url: 'https://stripe.test/pagar' }) {
    const chamadas: { url: string; form: URLSearchParams }[] = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      chamadas.push({ url, form: new URLSearchParams(String(init.body)) })
      return new Response(JSON.stringify(resposta), { status: 200 })
    })
    return chamadas
  }

  const pedido = {
    cycle: 'ANNUAL' as const,
    userId: '42',
    email: 'pessoa@exemplo.test',
    customerId: null,
    successUrl: 'https://colexa.test/conta/premium?pago=1',
    cancelUrl: 'https://colexa.test/conta/premium',
  }

  it('no cartão, assina com o preço cadastrado', async () => {
    const chamadas = capturar()

    await new StripePaymentProvider().createCheckout({ ...pedido, method: 'CARD' })

    const form = chamadas[0].form
    expect(chamadas[0].url).toContain('/checkout/sessions')
    expect(form.get('mode')).toBe('subscription')
    expect(form.get('line_items[0][price]')).toBe('price_anual')
    expect(form.get('payment_method_types[0]')).toBe('card')
    // É por ele que o webhook sabe de quem é o pagamento, sem confiar em e-mail.
    expect(form.get('client_reference_id')).toBe('42')
    expect(form.get('subscription_data[metadata][cycle]')).toBe('ANNUAL')
  })

  /*
   * No Pix não há assinatura do lado da Stripe: é um pagamento avulso, com o
   * preço inline. Se o valor daqui divergir do domínio, a tela promete um preço
   * e a cobrança faz outro.
   */
  it('no Pix, cobra uma vez o valor do domínio', async () => {
    const chamadas = capturar()

    await new StripePaymentProvider().createCheckout({ ...pedido, method: 'PIX' })

    const form = chamadas[0].form
    expect(form.get('mode')).toBe('payment')
    expect(form.get('payment_method_types[0]')).toBe('pix')
    expect(form.get('line_items[0][price_data][unit_amount]')).toBe(
      String(PLANS.ANNUAL.amountInCents),
    )
    expect(form.get('customer_creation')).toBe('always')
  })

  /* Cliente conhecido e e-mail juntos a Stripe recusa; e duas fichas para a
     mesma pessoa partiriam o histórico do portal. */
  it('reusa o cliente de um pagamento anterior', async () => {
    const chamadas = capturar()

    await new StripePaymentProvider().createCheckout({
      ...pedido,
      method: 'CARD',
      customerId: 'cus_9',
    })

    expect(chamadas[0].form.get('customer')).toBe('cus_9')
    expect(chamadas[0].form.get('customer_email')).toBeNull()
  })

  it('não segue adiante quando a Stripe não devolve endereço', async () => {
    capturar({ id: 'cs_1', url: null })

    await expect(
      new StripePaymentProvider().createCheckout({ ...pedido, method: 'CARD' }),
    ).rejects.toThrow(/endereço/i)
  })
})

describe('available', () => {
  it('é falso quando falta chave, e aí nada de pagamento é oferecido', () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '')

    expect(new StripePaymentProvider().available).toBe(false)
  })
})
