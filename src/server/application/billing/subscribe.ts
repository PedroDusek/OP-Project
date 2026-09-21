import type { PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { isPremium } from '@/server/application/authorization'
import {
  PLANS,
  type BillingCycle,
  type PaymentMethod,
  type SubscriptionStatus,
} from '@/server/domain/billing/plans'
import { trialDaysLeft, trialEnd } from '@/server/domain/billing/trial'
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
  /** `false` enquanto o provedor não libera Pix para esta conta (armadilha 82). */
  pixAvailable: boolean
  /** O teste grátis de 7 dias (decisão 102, mudança de 21/09). */
  trial: {
    /** `true` para quem nunca resgatou e ainda não é Premium. */
    claimable: boolean
    /** Quantos dias faltam, quando é o teste que está dando o acesso agora. */
    daysLeft: number | null
  }
}

export async function readBilling(
  prisma: PrismaClient,
  provider: PaymentProvider,
  user: AuthenticatedUser,
  now: Date = new Date(),
): Promise<BillingView> {
  const assinatura = await assinaturaAtual(prisma, user.id)
  // O carimbo do teste não anda na sessão: ele muda uma vez na vida, e ler do
  // banco aqui é mais barato que engordar tudo o que carrega `AuthenticatedUser`.
  const { trialStartedAt } = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { trialStartedAt: true },
  })

  return {
    premium: isPremium(user, now),
    premiumUntil: user.premiumUntil,
    trial: estadoDoTeste(trialStartedAt, user, now),
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
    pixAvailable: provider.pixAvailable,
  }
}

/**
 * Quem está em teste, e quem ainda pode resgatar.
 *
 * Não existe coluna dizendo "este acesso é de teste", e não precisa: o teste é
 * o que dá o acesso exatamente quando `premium_until` é o fim dele. Assinar
 * move a data para o fim do ciclo pago, e a conta deixa de estar em teste
 * sozinha. Uma coluna a mais seria um segundo lugar para a mesma verdade.
 */
function estadoDoTeste(
  trialStartedAt: Date | null,
  user: AuthenticatedUser,
  now: Date,
): BillingView['trial'] {
  // Quem já é Premium não resgata: queimaria os sete dias sem ganhar um
  // sequer, porque o acesso nunca é encurtado. Fica guardado para depois.
  if (!trialStartedAt) return { claimable: !isPremium(user, now), daysLeft: null }

  const fim = trialEnd(trialStartedAt)
  const dandoAcesso = user.premiumUntil?.getTime() === fim.getTime() && fim > now
  return { claimable: false, daysLeft: dandoAcesso ? trialDaysLeft(fim, now) : null }
}

/**
 * Resgata os 7 dias de teste (decisão 102, mudança de 21/09).
 *
 * Sem cartão e sem provedor: o teste não passa pela Stripe, porque pedir cartão
 * para experimentar é o atrito que ele existe para evitar. É a **única** porta
 * de Premium que não é nem pagamento nem comando de operação.
 *
 * Uma vez por conta, e a trava é o carimbo em `trial_started_at`. O que ela não
 * alcança está escrito em `domain/billing/trial.ts`, com a brecha aceita.
 */
export async function claimTrial(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  now: Date = new Date(),
): Promise<Date> {
  // Do banco, e não da sessão: a sessão pode ter sido montada antes de um
  // pagamento entrar, e as duas recusas abaixo precisam do estado de agora.
  const atual = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { plan: true, premiumUntil: true, trialStartedAt: true },
  })

  if (atual.trialStartedAt) {
    throw new ValidationError('Você já usou o seu teste grátis. Ele vale uma vez por conta.')
  }
  if (isPremium(atual, now)) {
    throw new ValidationError('Você já é Premium. Guarde o teste para quando precisar dele.')
  }

  const fim = trialEnd(now)
  /*
   * As duas condições vão no `where`, e não só nos `if` acima.
   *
   * Dois toques no botão ao mesmo tempo passariam pelos dois `if` e gravariam
   * dois carimbos — e, pior, um resgate que chegasse junto com um pagamento
   * **encurtaria** o acesso para sete dias. O `where` é o que o banco resolve
   * sozinho: a segunda tentativa não acha linha, e `count` zero conta a
   * história. As condições espelham `isPremium`.
   */
  const { count } = await prisma.user.updateMany({
    where: {
      id: user.id,
      trialStartedAt: null,
      OR: [{ plan: 'FREE', premiumUntil: null }, { premiumUntil: { lte: now } }],
    },
    data: { plan: 'PREMIUM', premiumUntil: fim, trialStartedAt: now },
  })
  if (count === 0) {
    throw new ValidationError('Não deu para resgatar agora. Atualize a página e veja como está o seu plano.')
  }

  return fim
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
  /*
   * O botão do Pix já não aparece quando o provedor não o tem (armadilha 82).
   * A conferência se repete aqui porque um formulário enviado à mão chegaria
   * com `forma=PIX` mesmo assim, e a recusa da Stripe viraria erro sem
   * explicação na tela.
   */
  if (input.method === 'PIX' && !provider.pixAvailable) {
    throw new ValidationError('O Pix ainda não está disponível. Por enquanto, a assinatura é no cartão.')
  }

  // Cliente de um pagamento anterior, quando houver: sem isso a mesma pessoa
  // vira duas fichas no provedor, e o portal mostraria metade do histórico.
  const anterior = await assinaturaAtual(prisma, user.id)

  /*
   * Quem já assina no cartão não assina de novo.
   *
   * A Stripe recusa por conta própria — a conta está com "uma assinatura por
   * cliente" ligada —, mas a recusa dela chega como erro de integração, e a
   * pessoa veria "algo deu errado" sem saber que o problema é já ter o que
   * está tentando comprar. Dizer isto antes de sair do ColeXa é mais honesto, e
   * aponta para onde se resolve.
   *
   * Cancelada e atrasada **não** caem aqui: são exatamente os casos em que
   * pagar de novo é o que a pessoa quer. Pix também não, que é avulso e não
   * cria assinatura do lado de lá.
   */
  if (input.method === 'CARD' && anterior?.method === 'CARD' && anterior.status === 'ACTIVE') {
    throw new ValidationError('Você já tem uma assinatura ativa. Veja em Gerenciar pagamento.')
  }

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
