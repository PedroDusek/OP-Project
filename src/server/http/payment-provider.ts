import type { BillingCycle, PaymentMethod } from '@/server/domain/billing/plans'

/**
 * Contrato do provedor de pagamento (decisão 102).
 *
 * Camada: http. Sem I/O: apenas o formato das operações.
 *
 * Existe para a Stripe não vazar para dentro do produto. O caso de uso pede
 * "uma sessão de pagamento para esta pessoa, neste ciclo" e recebe um endereço;
 * quem sabe o que é uma `checkout.session` é `infrastructure`. No dia em que o
 * Pix Automático pesar mais que o resto (decisão 102), troca-se o que está
 * atrás desta porta.
 */

export interface CheckoutRequest {
  cycle: BillingCycle
  method: PaymentMethod
  /** Identifica a pessoa na volta do provedor. Nunca o e-mail, nunca o nome. */
  userId: string
  email: string
  /** Cliente já existente no provedor, quando a pessoa já pagou antes. */
  customerId: string | null
  successUrl: string
  cancelUrl: string
}

export interface CheckoutSession {
  /** Para onde mandar a pessoa. */
  url: string
  sessionId: string
}

/** O que um aviso do provedor diz, já traduzido para o nosso vocabulário. */
export interface PaymentEventData {
  id: string
  type: string
  /** O corpo inteiro, guardado para investigar cobrança contestada. */
  payload: unknown
}

export interface PaymentProvider {
  readonly name: string
  /** `false` quando as chaves não estão configuradas neste ambiente. */
  readonly available: boolean
  /**
   * `false` enquanto o provedor não libera Pix para esta conta.
   *
   * Separado de `available` porque as duas coisas falham por motivos
   * diferentes: sem chave **nada** funciona; sem Pix o cartão continua
   * funcionando. Quem decide é o ambiente, não o código (armadilha 82).
   */
  readonly pixAvailable: boolean
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>
  /** Endereço do portal onde a pessoa troca o cartão ou cancela. */
  createPortalSession(customerId: string, returnUrl: string): Promise<string>
  /**
   * Confere a assinatura do aviso e devolve o conteúdo.
   *
   * Lança quando a assinatura não confere: um aviso forjado moveria o plano de
   * quem o forjou, e é por isso que esta conferência não é opcional.
   */
  parseEvent(rawBody: string, signature: string | null): PaymentEventData
}
