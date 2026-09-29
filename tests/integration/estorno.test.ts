import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { AuthenticatedUser } from '@/server/application/auth'
import { handlePaymentEvent } from '@/server/application/billing/handle-payment-event'
import { createUser, disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * Estorno corta o acesso na hora (decisão 102, mudança de 21/09).
 *
 * A exceção à regra de nunca encurtar. Ela existe porque o direito de
 * arrependimento do CDC — sete dias — vale querendo ou não: sem cortar, quem
 * pedisse o dinheiro de volta ficaria com o ciclo inteiro de Premium de graça.
 *
 * O que estes testes protegem é o **limite** da exceção: ela desfaz o que
 * aquele pagamento deu, e não mais do que isso. Um assinante com cortesia até
 * 2046 que peça estorno de um mês não pode perder vinte anos.
 */

const AGORA = new Date('2026-10-15T12:00:00Z')
const FIM_DO_CICLO = new Date('2026-11-15T12:00:00Z')

async function pessoa(): Promise<AuthenticatedUser> {
  const criada = await createUser('Assinante')
  return { id: criada.id, email: criada.email, name: 'Assinante', plan: 'FREE', premiumUntil: null }
}

/** Uma pessoa que pagou: ficha ativa e acesso até o fim do ciclo. */
async function comAssinatura(premiumUntil: Date = FIM_DO_CICLO) {
  const ana = await pessoa()
  await testPrisma().user.update({
    where: { id: ana.id },
    data: { plan: 'PREMIUM', premiumUntil },
  })
  await testPrisma().subscription.create({
    data: {
      userId: ana.id,
      customerId: 'cus_ana',
      subscriptionId: 'sub_ana',
      status: 'ACTIVE',
      cycle: 'MONTHLY',
      method: 'CARD',
      currentPeriodEnd: FIM_DO_CICLO,
      cancelAtPeriodEnd: false,
    },
  })
  return ana
}

function estorno(devolvido: number, total = 1490, id = `evt_${Math.random()}`) {
  return {
    id,
    type: 'charge.refunded',
    payload: {
      data: {
        object: {
          object: 'charge',
          id: 'ch_ana',
          customer: 'cus_ana',
          amount: total,
          amount_refunded: devolvido,
        },
      },
    },
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

describe('charge.refunded', () => {
  it('corta o acesso quando o dinheiro volta inteiro', async () => {
    const ana = await comAssinatura()

    const outcome = await handlePaymentEvent(testPrisma(), estorno(1490), AGORA)

    expect(outcome.userId).toBe(ana.id)
    const depois = await usuarioDo(ana)
    expect(depois.plan).toBe('FREE')
    expect(depois.premiumUntil).toBeNull()
  })

  /*
   * Devolver parte do valor não é desfazer a compra. Cortar o mês inteiro por
   * causa de R$ 1 puniria justamente quem foi ressarcido de um erro nosso.
   */
  it('não corta no estorno parcial', async () => {
    const ana = await comAssinatura()

    await handlePaymentEvent(testPrisma(), estorno(500), AGORA)

    const depois = await usuarioDo(ana)
    expect(depois.plan).toBe('PREMIUM')
    expect(depois.premiumUntil).toEqual(FIM_DO_CICLO)
  })

  /*
   * O caso que a exceção **não** pode atropelar: a cortesia do dono do produto
   * e a dos testadores (decisão 102 item 4). O estorno desfaz o que aquele
   * pagamento deu, e a data de 2046 não veio dele.
   */
  it('não encurta acesso mais longo que o ciclo estornado', async () => {
    const longe = new Date('2046-09-19T12:00:00Z')
    const ana = await comAssinatura(longe)

    await handlePaymentEvent(testPrisma(), estorno(1490), AGORA)

    const depois = await usuarioDo(ana)
    expect(depois.plan).toBe('PREMIUM')
    expect(depois.premiumUntil).toEqual(longe)
  })

  /*
   * Sem saber o que o pagamento deu, o acesso cai. Das duas falhas possíveis,
   * deixar Premium de graça para quem foi ressarcido custa dinheiro toda vez; a
   * outra se conserta com um comando.
   */
  it('corta quando a ficha não sabe o fim do ciclo', async () => {
    const ana = await pessoa()
    await testPrisma().user.update({
      where: { id: ana.id },
      data: { plan: 'PREMIUM', premiumUntil: FIM_DO_CICLO },
    })
    await testPrisma().subscription.create({
      data: {
        userId: ana.id,
        customerId: 'cus_ana',
        status: 'ACTIVE',
        cycle: 'MONTHLY',
        method: 'CARD',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
    })

    await handlePaymentEvent(testPrisma(), estorno(1490), AGORA)

    expect((await usuarioDo(ana)).plan).toBe('FREE')
  })

  /* Sem os valores não dá para saber se o estorno foi total: não corta. */
  it('não corta um aviso sem os valores', async () => {
    const ana = await comAssinatura()

    await handlePaymentEvent(testPrisma(), {
      id: 'evt_sem_valores',
      type: 'charge.refunded',
      payload: { data: { object: { object: 'charge', customer: 'cus_ana' } } },
    })

    expect((await usuarioDo(ana)).plan).toBe('PREMIUM')
  })

  /*
   * A cobrança estornada não traz `user_id` nenhum: ela nasce da fatura, e não
   * da nossa sessão de pagamento. Quem liga o estorno à conta é o cliente já
   * gravado na ficha — por isso o estorno de alguém que nunca assinou aqui é
   * ignorado, em vez de derrubar o webhook.
   */
  it('ignora estorno de cliente que não é nosso', async () => {
    const ana = await comAssinatura()

    const outcome = await handlePaymentEvent(testPrisma(), {
      id: 'evt_outro',
      type: 'charge.refunded',
      payload: {
        data: { object: { object: 'charge', customer: 'cus_de_outra_integracao', amount: 1490, amount_refunded: 1490 } },
      },
    })

    expect(outcome.userId).toBeNull()
    expect((await usuarioDo(ana)).plan).toBe('PREMIUM')
  })

  /* A ficha continua contando o que a Stripe sabe: estorno não é cancelamento. */
  it('não mexe no status da assinatura', async () => {
    const ana = await comAssinatura()

    await handlePaymentEvent(testPrisma(), estorno(1490), AGORA)

    const ficha = await testPrisma().subscription.findFirstOrThrow({ where: { userId: ana.id } })
    expect(ficha.status).toBe('ACTIVE')
  })
})
