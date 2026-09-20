import { createHmac, timingSafeEqual } from 'node:crypto'
import { PLANS } from '@/server/domain/billing/plans'
import type {
  CheckoutRequest,
  CheckoutSession,
  PaymentEventData,
  PaymentProvider,
} from '@/server/http/payment-provider'

/**
 * A Stripe (decisão 102).
 *
 * Camada: infrastructure.
 *
 * `fetch` na API REST, sem o SDK, pelo mesmo motivo do Supabase Storage e do
 * Auth: são três chamadas, e a API delas é estável e documentada em formulário
 * simples. O SDK traria um pacote grande para embrulhar `fetch`.
 *
 * ## Cartão e Pix são coisas diferentes do lado de lá
 *
 * **Cartão** vira uma assinatura (`mode=subscription`), que a Stripe renova
 * sozinha e avisa a cada ciclo.
 *
 * **Pix** é um pagamento avulso (`mode=payment`): a Stripe cobra uma vez e não
 * volta. Quem conta o ciclo é o ColeXa (`cycleEnd`), e o preço vai inline, em
 * `price_data` — sem isso seriam quatro preços cadastrados à mão no painel, e
 * dois deles só para o Pix.
 */

const API = 'https://api.stripe.com/v1'

export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe'

  private config() {
    const secretKey = process.env.STRIPE_SECRET_KEY
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    const prices = {
      MONTHLY: process.env.STRIPE_PRICE_MONTHLY,
      ANNUAL: process.env.STRIPE_PRICE_ANNUAL,
    }
    if (!secretKey || !webhookSecret || !prices.MONTHLY || !prices.ANNUAL) return null
    return { secretKey, webhookSecret, prices: prices as Record<'MONTHLY' | 'ANNUAL', string> }
  }

  get available(): boolean {
    return this.config() !== null
  }

  private async post<T>(path: string, form: Record<string, string>): Promise<T> {
    const config = this.config()
    if (!config) throw new Error('As chaves da Stripe não estão configuradas neste ambiente.')

    const response = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(20_000),
    })

    const body = (await response.json()) as { error?: { message?: string } }
    if (!response.ok) {
      // A mensagem da Stripe entra no log, nunca na tela: ela pode citar id de
      // cliente e de preço, que não dizem nada a quem está assinando.
      throw new Error(`Stripe ${path}: ${response.status} ${body.error?.message ?? ''}`.trim())
    }
    return body as T
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const config = this.config()!
    const plano = PLANS[request.cycle]

    const form: Record<string, string> = {
      mode: request.method === 'CARD' ? 'subscription' : 'payment',
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
      // Volta na sessão e no aviso: é por ele que o webhook sabe de quem é o
      // pagamento sem confiar em e-mail digitado.
      client_reference_id: request.userId,
      'metadata[user_id]': request.userId,
      'metadata[cycle]': request.cycle,
      'metadata[method]': request.method,
      'line_items[0][quantity]': '1',
      locale: 'pt-BR',
    }

    // Cliente existente quando a pessoa já pagou antes; e-mail quando é a
    // primeira vez. Os dois juntos a Stripe recusa.
    if (request.customerId) form.customer = request.customerId
    else form.customer_email = request.email

    if (request.method === 'CARD') {
      form['payment_method_types[0]'] = 'card'
      form['line_items[0][price]'] = config.prices[request.cycle]
      form['subscription_data[metadata][user_id]'] = request.userId
      form['subscription_data[metadata][cycle]'] = request.cycle
    } else {
      form['payment_method_types[0]'] = 'pix'
      form['line_items[0][price_data][currency]'] = 'brl'
      form['line_items[0][price_data][unit_amount]'] = String(plano.amountInCents)
      form['line_items[0][price_data][product_data][name]'] =
        request.cycle === 'ANNUAL' ? 'ColeXa Premium — 1 ano' : 'ColeXa Premium — 1 mês'
      // Sem isto o pagamento avulso não guarda o cliente, e a próxima vez
      // criaria outro — duas fichas para a mesma pessoa.
      if (!request.customerId) form.customer_creation = 'always'
    }

    const session = await this.post<{ id: string; url: string | null }>('/checkout/sessions', form)
    if (!session.url) throw new Error('A Stripe não devolveu o endereço da sessão de pagamento.')
    return { url: session.url, sessionId: session.id }
  }

  async createPortalSession(customerId: string, returnUrl: string): Promise<string> {
    const session = await this.post<{ url: string }>('/billing_portal/sessions', {
      customer: customerId,
      return_url: returnUrl,
    })
    return session.url
  }

  /**
   * Confere a assinatura do aviso, como a Stripe documenta.
   *
   * O corpo precisa ser o **texto cru**: reserializar o JSON muda um espaço e
   * derruba a conferência. Por isso a rota lê `await request.text()` e nunca
   * `request.json()`.
   *
   * O carimbo de tempo entra no que é assinado, e recusamos o que tem mais de
   * cinco minutos: sem isso, um aviso legítimo capturado hoje poderia ser
   * reenviado amanhã por quem o capturou.
   */
  parseEvent(rawBody: string, signature: string | null): PaymentEventData {
    const config = this.config()
    if (!config) throw new Error('As chaves da Stripe não estão configuradas neste ambiente.')
    if (!signature) throw new Error('Aviso sem assinatura.')

    const partes = Object.fromEntries(
      signature.split(',').map((parte) => {
        const [chave, ...resto] = parte.trim().split('=')
        return [chave, resto.join('=')]
      }),
    )
    const timestamp = partes.t
    const assinaturaRecebida = partes.v1
    if (!timestamp || !assinaturaRecebida) throw new Error('Assinatura em formato desconhecido.')

    const idade = Math.abs(Date.now() / 1000 - Number(timestamp))
    if (!Number.isFinite(idade) || idade > 300) throw new Error('Aviso fora da janela de cinco minutos.')

    const esperada = createHmac('sha256', config.webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex')
    const a = Buffer.from(esperada, 'utf8')
    const b = Buffer.from(assinaturaRecebida, 'utf8')
    // Comparação de tempo constante: comparar com `===` vaza, pelo tempo de
    // resposta, quantos caracteres do começo estavam certos.
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Assinatura não confere.')

    const evento = JSON.parse(rawBody) as { id: string; type: string }
    return { id: evento.id, type: evento.type, payload: JSON.parse(rawBody) }
  }
}
