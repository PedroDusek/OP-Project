import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { AuthenticatedUser } from '@/server/application/auth'
import { claimTrial, readBilling } from '@/server/application/billing/subscribe'
import { handlePaymentEvent } from '@/server/application/billing/handle-payment-event'
import { TRIAL_DAYS, trialEnd } from '@/server/domain/billing/trial'
import { ValidationError } from '@/server/domain/errors'
import type { PaymentProvider } from '@/server/http/payment-provider'
import { createUser, disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * O teste grátis de 7 dias (decisão 102, mudança de 21/09).
 *
 * O que se protege: vale **uma vez por conta**, não encurta um Premium mais
 * longo, e não vira cobrança. A trava é o carimbo em `trial_started_at`, e ela
 * está no `where` do update — não num `if` — porque dois toques no botão ao
 * mesmo tempo passariam pelos dois `if`.
 */

const AGORA = new Date('2026-10-15T12:00:00Z')
const FIM = trialEnd(AGORA)

const provider: PaymentProvider = {
  name: 'falso',
  available: true,
  pixAvailable: false,
  createCheckout: async () => ({ url: 'https://stripe.test/pagar', sessionId: 'cs_1' }),
  createPortalSession: async () => 'https://stripe.test/portal',
  customerOfCharge: async () => null,
  parseEvent: () => {
    throw new Error('não usado aqui')
  },
}

async function pessoa(premiumUntil: Date | null = null): Promise<AuthenticatedUser> {
  const criada = await createUser('Testadora')
  if (premiumUntil) {
    await testPrisma().user.update({
      where: { id: criada.id },
      data: { plan: 'PREMIUM', premiumUntil },
    })
  }
  return {
    id: criada.id,
    email: criada.email,
    name: 'Testadora',
    plan: premiumUntil ? 'PREMIUM' : 'FREE',
    premiumUntil,
  }
}

const usuarioDo = async (user: AuthenticatedUser) =>
  testPrisma().user.findUniqueOrThrow({ where: { id: user.id } })

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('claimTrial', () => {
  it('libera sete dias e carimba a conta', async () => {
    const ana = await pessoa()

    const fim = await claimTrial(testPrisma(), ana, AGORA)

    expect(fim).toEqual(FIM)
    const depois = await usuarioDo(ana)
    expect(depois.plan).toBe('PREMIUM')
    expect(depois.premiumUntil).toEqual(FIM)
    expect(depois.trialStartedAt).toEqual(AGORA)
  })

  it('recusa a segunda vez, com o motivo', async () => {
    const ana = await pessoa()
    await claimTrial(testPrisma(), ana, AGORA)

    await expect(claimTrial(testPrisma(), ana, AGORA)).rejects.toThrow(/uma vez por conta/i)
  })

  /*
   * O caso que importa de verdade: o teste acaba, a pessoa volta ao Free, e o
   * botão não pode reaparecer. O carimbo fica; só `premium_until` vence.
   */
  it('não volta a valer depois de o teste acabar', async () => {
    const ana = await pessoa()
    await claimTrial(testPrisma(), ana, AGORA)
    const depoisDoFim = new Date(FIM.getTime() + 60_000)

    await expect(claimTrial(testPrisma(), { ...ana, premiumUntil: FIM }, depoisDoFim)).rejects.toThrow(
      ValidationError,
    )
  })

  /*
   * Quem tem cortesia longa — o caso do dono do produto e dos testadores da
   * decisão 102 — queimaria os sete dias sem ganhar um só, porque o acesso
   * nunca é encurtado. Pior: sem esta recusa, o update encurtaria de verdade.
   */
  it('recusa quem já é Premium, e não encurta o acesso dele', async () => {
    const longe = new Date('2046-09-19T12:00:00Z')
    const ana = await pessoa(longe)

    await expect(claimTrial(testPrisma(), ana, AGORA)).rejects.toThrow(/já é Premium/i)

    const depois = await usuarioDo(ana)
    expect(depois.premiumUntil).toEqual(longe)
    expect(depois.trialStartedAt).toBeNull()
  })

  /*
   * A sessão pode ter sido montada antes de o pagamento entrar. Se o caso de
   * uso confiasse nela, um resgate nesse intervalo cortaria um ano de acesso
   * para sete dias — por isso o estado vem do banco, e a condição vai no `where`.
   */
  it('não encurta acesso que entrou depois de a sessão ser montada', async () => {
    const ana = await pessoa()
    const longe = new Date('2027-10-15T12:00:00Z')
    await testPrisma().user.update({
      where: { id: ana.id },
      data: { plan: 'PREMIUM', premiumUntil: longe },
    })

    // `ana` ainda diz FREE, como uma sessão velha diria.
    await expect(claimTrial(testPrisma(), ana, AGORA)).rejects.toThrow(ValidationError)
    expect((await usuarioDo(ana)).premiumUntil).toEqual(longe)
  })

  /* Dois toques no botão: o banco decide, e só um carimbo entra. */
  it('dois resgates ao mesmo tempo liberam um só', async () => {
    const ana = await pessoa()

    const resultados = await Promise.allSettled([
      claimTrial(testPrisma(), ana, AGORA),
      claimTrial(testPrisma(), ana, AGORA),
    ])

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect((await usuarioDo(ana)).premiumUntil).toEqual(FIM)
  })

  /* O teste não passa pela Stripe: nenhuma ficha de assinatura nasce dele. */
  it('não cria assinatura nenhuma', async () => {
    const ana = await pessoa()

    await claimTrial(testPrisma(), ana, AGORA)

    expect(await testPrisma().subscription.count({ where: { userId: ana.id } })).toBe(0)
  })
})

describe('readBilling, com o teste', () => {
  it('oferece a quem nunca resgatou', async () => {
    const ana = await pessoa()

    const view = await readBilling(testPrisma(), provider, ana, AGORA)

    expect(view.trial).toEqual({ claimable: true, daysLeft: null })
  })

  it('não oferece a quem já é Premium', async () => {
    const ana = await pessoa(new Date('2046-09-19T12:00:00Z'))

    const view = await readBilling(testPrisma(), provider, ana, AGORA)

    expect(view.trial.claimable).toBe(false)
  })

  it('conta os dias enquanto o teste corre', async () => {
    const ana = await pessoa()
    await claimTrial(testPrisma(), ana, AGORA)
    const emTeste = { ...ana, plan: 'PREMIUM', premiumUntil: FIM }

    const view = await readBilling(testPrisma(), provider, emTeste, AGORA)
    expect(view.trial).toEqual({ claimable: false, daysLeft: TRIAL_DAYS })

    const faltandoDois = new Date(FIM.getTime() - 36 * 60 * 60 * 1000)
    const depois = await readBilling(testPrisma(), provider, emTeste, faltandoDois)
    expect(depois.trial.daysLeft).toBe(2)
  })

  /*
   * Assinar durante o teste move `premium_until` para o fim do ciclo pago, e é
   * isso — e não uma coluna nova — que diz que a conta saiu do teste.
   */
  it('deixa de contar quando a assinatura assume', async () => {
    const ana = await pessoa()
    await claimTrial(testPrisma(), ana, AGORA)

    const fimDoCiclo = Math.floor(new Date('2027-10-15T12:00:00Z').getTime() / 1000)
    await handlePaymentEvent(
      testPrisma(),
      {
        id: 'evt_assina',
        type: 'invoice.paid',
        payload: {
          data: {
            object: {
              customer: 'cus_ana',
              parent: {
                subscription_details: {
                  subscription: 'sub_ana',
                  metadata: { cycle: 'ANNUAL', user_id: String(ana.id) },
                },
              },
              lines: { data: [{ period: { end: fimDoCiclo } }] },
            },
          },
        },
      },
      AGORA,
    )

    const paga = await usuarioDo(ana)
    const view = await readBilling(
      testPrisma(),
      provider,
      { ...ana, plan: paga.plan, premiumUntil: paga.premiumUntil },
      AGORA,
    )

    expect(view.trial).toEqual({ claimable: false, daysLeft: null })
    // E o acesso é o do ciclo pago, não o do teste: pagar nunca encurta.
    expect(paga.premiumUntil).toEqual(new Date(fimDoCiclo * 1000))
  })
})
