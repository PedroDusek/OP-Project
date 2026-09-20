import { NextResponse } from 'next/server'
import {
  InvalidPaymentSignature,
  paymentsConfigured,
  processPaymentWebhook,
} from '@/server/application/billing/webhook'

/**
 * O aviso da Stripe (decisão 102).
 *
 * Camada: `app`. É a **única** porta que libera Premium pago: a volta pela tela
 * não serve, porque o endereço de sucesso é adivinhável.
 *
 * Sem sessão, de propósito: quem chama é a Stripe, e a prova de que é ela está
 * na assinatura do corpo. Assinatura que não confere é 400, e a Stripe não
 * reenvia — um aviso forjado não vira tentativa eterna.
 *
 * O corpo é lido como **texto cru**: `request.json()` reserializaria e mudaria
 * um espaço, e a assinatura passaria a não conferir. É o erro clássico desta
 * integração.
 */
export async function POST(request: Request): Promise<Response> {
  if (!paymentsConfigured()) {
    // Ambiente sem chaves (local, CI): nada a processar, e nada a reenviar.
    return NextResponse.json({ ok: false, motivo: 'pagamento nao configurado' }, { status: 503 })
  }

  const rawBody = await request.text()

  try {
    const outcome = await processPaymentWebhook(rawBody, request.headers.get('stripe-signature'))
    return NextResponse.json({
      ok: true,
      duplicate: outcome.duplicate,
      ignored: outcome.ignored,
    })
  } catch (error) {
    if (error instanceof InvalidPaymentSignature) {
      console.warn('[pagamentos] aviso recusado:', error.message)
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    /*
     * 500 de propósito: é o que faz a Stripe reenviar. O log leva só a
     * mensagem — nunca o corpo, que carrega dado de cobrança.
     */
    console.error('[pagamentos] falha ao processar aviso:', error instanceof Error ? error.message : error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
