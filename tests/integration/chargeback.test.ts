import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedUser } from '@/server/application/auth'
import { handlePaymentEvent } from '@/server/application/billing/handle-payment-event'
import { createUser, disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * Contestação de cobrança corta o acesso, igual ao estorno (decisão 102,
 * mudança de 21/09).
 *
 * O que muda em relação ao estorno não é a regra, é **achar de quem é**: o
 * aviso de disputa traz a cobrança e o pagamento, e **não** traz o cliente. Por
 * isso esta é a única vez em que o webhook pergunta algo ao provedor, e por
 * isso o provedor aparece nestes testes e em nenhum outro.
 */

const AGORA = new Date('2026-10-15T12:00:00Z')
const FIM_DO_CICLO = new Date('2026-11-15T12:00:00Z')

/** O provedor, que só sabe dizer de quem é uma cobrança. */
function provedor(mapa: Record<string, string | null>) {
  return { customerOfCharge: vi.fn(async (id: string) => mapa[id] ?? null) }
}

async function comAssinatura(premiumUntil: Date = FIM_DO_CICLO): Promise<AuthenticatedUser> {
  const criada = await createUser('Assinante')
  await testPrisma().user.update({
    where: { id: criada.id },
    data: { plan: 'PREMIUM', premiumUntil },
  })
  await testPrisma().subscription.create({
    data: {
      userId: criada.id,
      customerId: 'cus_ana',
      subscriptionId: 'sub_ana',
      status: 'ACTIVE',
      cycle: 'MONTHLY',
      method: 'CARD',
      currentPeriodEnd: FIM_DO_CICLO,
      cancelAtPeriodEnd: false,
    },
  })
  return { id: criada.id, email: criada.email, name: 'Assinante', plan: 'PREMIUM', premiumUntil }
}

/** O corpo da disputa: cobrança e pagamento, sem cliente. */
function disputa(charge = 'ch_ana', id = `evt_${Math.random()}`) {
  return {
    id,
    type: 'charge.dispute.created',
    payload: {
      data: {
        object: {
          object: 'dispute',
          id: 'dp_ana',
          charge,
          payment_intent: 'pi_ana',
          amount: 1490,
          reason: 'fraudulent',
          status: 'warning_needs_response',
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

describe('charge.dispute.created', () => {
  it('corta o acesso de quem contestou', async () => {
    const ana = await comAssinatura()
    const stripe = provedor({ ch_ana: 'cus_ana' })

    const outcome = await handlePaymentEvent(testPrisma(), disputa(), AGORA, stripe)

    expect(outcome.userId).toBe(ana.id)
    expect(stripe.customerOfCharge).toHaveBeenCalledWith('ch_ana')
    const depois = await usuarioDo(ana)
    expect(depois.plan).toBe('FREE')
    expect(depois.premiumUntil).toBeNull()
  })

  /*
   * O mesmo limite do estorno: a contestação desfaz o que aquele pagamento deu,
   * e a cortesia não veio dele.
   */
  it('não encurta acesso mais longo que o ciclo contestado', async () => {
    const longe = new Date('2046-09-19T12:00:00Z')
    const ana = await comAssinatura(longe)

    await handlePaymentEvent(testPrisma(), disputa(), AGORA, provedor({ ch_ana: 'cus_ana' }))

    const depois = await usuarioDo(ana)
    expect(depois.plan).toBe('PREMIUM')
    expect(depois.premiumUntil).toEqual(longe)
  })

  /*
   * Contestação de outra integração da mesma conta Stripe: sem dono, nada a
   * fazer. Derrubar o webhook por causa dela faria a Stripe reenviar para
   * sempre.
   */
  it('ignora contestação de cobrança que não é nossa', async () => {
    const ana = await comAssinatura()

    const outcome = await handlePaymentEvent(
      testPrisma(),
      disputa('ch_de_outro'),
      AGORA,
      provedor({ ch_de_outro: 'cus_de_outra_integracao' }),
    )

    expect(outcome.userId).toBeNull()
    expect((await usuarioDo(ana)).plan).toBe('PREMIUM')
  })

  /*
   * O provedor pode não responder — `customerOfCharge` engole a falha e devolve
   * `null` para um GET fora do ar não derrubar o webhook inteiro. A contestação
   * fica guardada em `payment_events` para ser vista à mão.
   */
  it('não quebra quando o provedor não sabe dizer o cliente', async () => {
    const ana = await comAssinatura()

    const outcome = await handlePaymentEvent(testPrisma(), disputa(), AGORA, provedor({}))

    expect(outcome.userId).toBeNull()
    expect(outcome.ignored).toBe(false)
    expect((await usuarioDo(ana)).plan).toBe('PREMIUM')
  })

  /* Sem provedor, o aviso segue o caminho de quem não tem dono, sem estourar. */
  it('não quebra sem provedor nenhum', async () => {
    const ana = await comAssinatura()

    await expect(handlePaymentEvent(testPrisma(), disputa(), AGORA)).resolves.toMatchObject({
      userId: null,
    })
    expect((await usuarioDo(ana)).plan).toBe('PREMIUM')
  })

  /*
   * Se um dia a Stripe passar a mandar o cliente na disputa, o atalho vale e a
   * ida à rede nem acontece. Escrito assim de propósito: a forma do aviso muda
   * com a versão da API, e já mudou uma vez neste projeto (armadilha 81).
   */
  it('usa o cliente do próprio aviso quando ele vem', async () => {
    const ana = await comAssinatura()
    const stripe = provedor({})

    await handlePaymentEvent(
      testPrisma(),
      {
        id: 'evt_com_cliente',
        type: 'charge.dispute.created',
        payload: { data: { object: { object: 'dispute', charge: 'ch_ana', customer: 'cus_ana' } } },
      },
      AGORA,
      stripe,
    )

    expect(stripe.customerOfCharge).not.toHaveBeenCalled()
    expect((await usuarioDo(ana)).plan).toBe('FREE')
  })

  /* Contestação não é cancelamento: a ficha continua dizendo o que a Stripe sabe. */
  it('não mexe no status da assinatura', async () => {
    const ana = await comAssinatura()

    await handlePaymentEvent(testPrisma(), disputa(), AGORA, provedor({ ch_ana: 'cus_ana' }))

    const ficha = await testPrisma().subscription.findFirstOrThrow({ where: { userId: ana.id } })
    expect(ficha.status).toBe('ACTIVE')
  })
})
