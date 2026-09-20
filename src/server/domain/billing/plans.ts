/**
 * O Premium pago (decisão 102).
 *
 * Camada: domain. Puro: preços, ciclos e a aritmética de até quando o acesso
 * vale. Nada aqui sabe que a Stripe existe — o provedor entra em
 * `infrastructure`, e trocá-lo um dia não deve mexer nestas contas.
 */

export type BillingCycle = 'MONTHLY' | 'ANNUAL'
export type PaymentMethod = 'CARD' | 'PIX'
/**
 * Como o ColeXa lê a assinatura, e não como a Stripe a nomeia.
 *
 * O acesso **não** sai daqui: ele sai de `users.premium_until`, que vale até o
 * fim do ciclo pago em qualquer status. Cancelada e atrasada continuam
 * liberando até lá — o dinheiro daquele mês já entrou, e cortar no primeiro dia
 * de atraso puniria quem só trocou de cartão. Vencido o fim do ciclo, a conta
 * cai sozinha, sem tarefa nenhuma para rodar.
 */
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED'

export interface PlanPrice {
  cycle: BillingCycle
  /** Em centavos, porque dinheiro não se guarda em ponto flutuante. */
  amountInCents: number
  label: string
  /** O que aparece ao lado do anual: quanto sai por mês. */
  monthlyEquivalentInCents: number
}

/**
 * Os preços, escolhidos pelo dono do produto em 19/09.
 *
 * O anual é dez meses pelo preço de doze. Ele mora aqui, e não só na Stripe,
 * porque a tela precisa dizer o preço antes de a pessoa sair do ColeXa — e
 * porque um número que existe em dois lugares tem de ser conferido: o teste
 * `plans.test.ts` compara com o que a Stripe devolve na criação da sessão.
 */
export const PLANS: Record<BillingCycle, PlanPrice> = {
  MONTHLY: {
    cycle: 'MONTHLY',
    amountInCents: 1490,
    label: 'R$ 14,90 por mês',
    monthlyEquivalentInCents: 1490,
  },
  ANNUAL: {
    cycle: 'ANNUAL',
    amountInCents: 14900,
    label: 'R$ 149,00 por ano',
    // 14900 / 12 = 1241,67 — arredondado para cima, como preço se exibe.
    monthlyEquivalentInCents: 1242,
  },
}

/** "R$ 14,90", em português. */
export function formatBrl(amountInCents: number): string {
  return (amountInCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

/** Quanto o anual economiza por ano, em centavos. */
export function annualSavingsInCents(): number {
  return PLANS.MONTHLY.amountInCents * 12 - PLANS.ANNUAL.amountInCents
}

/**
 * O fim do ciclo, a partir de quando ele começou.
 *
 * Usado só no Pix, que não tem assinatura do outro lado para informar a data
 * (decisão 102): cada pagamento compra um ciclo, e é o ColeXa que conta.
 *
 * Soma em mês de calendário, e não em 30 dias: quem paga dia 31 de janeiro
 * ganha 28 de fevereiro, que é o que a data seguinte significa. `setMonth` em
 * dia inexistente vira o mês seguinte, então o dia é preso ao último do mês.
 */
export function cycleEnd(from: Date, cycle: BillingCycle): Date {
  const meses = cycle === 'ANNUAL' ? 12 : 1
  const fim = new Date(from)
  const dia = fim.getUTCDate()
  fim.setUTCMonth(fim.getUTCMonth() + meses, 1)
  const ultimoDiaDoMes = new Date(Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth() + 1, 0)).getUTCDate()
  fim.setUTCDate(Math.min(dia, ultimoDiaDoMes))
  return fim
}

/**
 * O novo fim do acesso quando um pagamento avulso entra.
 *
 * Emenda no que já existe, e não no dia de hoje: quem paga antes de vencer não
 * pode perder os dias que já comprou. Quem paga depois de vencer recomeça de
 * hoje, porque o período parado não é devido a ninguém.
 */
export function extendPremium(current: Date | null, paidAt: Date, cycle: BillingCycle): Date {
  const base = current && current > paidAt ? current : paidAt
  return cycleEnd(base, cycle)
}

/**
 * O status da Stripe traduzido para o nosso.
 *
 * Desconhecido vira `PAST_DUE`, e não `ACTIVE`: diante de um estado que não
 * conhecemos, o lado seguro é o que não dá acesso de graça — e `PAST_DUE`
 * ainda respeita o ciclo já pago.
 */
export function statusFromStripe(status: string): SubscriptionStatus {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'ACTIVE'
    case 'canceled':
    case 'incomplete_expired':
      return 'CANCELED'
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
    case 'paused':
      return 'PAST_DUE'
    default:
      return 'PAST_DUE'
  }
}
