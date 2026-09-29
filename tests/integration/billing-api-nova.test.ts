import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { AuthenticatedUser } from '@/server/application/auth'
import { handlePaymentEvent } from '@/server/application/billing/handle-payment-event'
import { createUser, disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * O formato que a Stripe manda hoje (21/09), e o que ele quebrou.
 *
 * O primeiro pagamento de verdade não virou Premium. O corpo guardado em
 * `payment_events` mostrou por quê: na API `2026-08-26`, a fatura **não traz**
 * `subscription` nem `metadata` no topo — os dois foram para
 * `parent.subscription_details`. Sem achar o `user_id`, o aviso foi descartado
 * como "de outra integração", e o acesso nunca entrou.
 *
 * Pior: a ordem de chegada não é a esperada. A **fatura chegou antes** da
 * sessão de pagamento, então não bastava ler os dados na sessão.
 *
 * Os corpos abaixo são recortes do aviso real, com identificadores encurtados.
 */

const FIM_DO_CICLO = 1821505318
const INICIO = 1789969318

function faturaPaga(userId: string) {
  return {
    id: 'evt_fatura',
    type: 'invoice.paid',
    payload: {
      data: {
        object: {
          object: 'invoice',
          customer: 'cus_teste',
          // Sem `subscription` e sem `metadata` no topo: é o ponto da mudança.
          metadata: {},
          period_end: INICIO,
          parent: {
            type: 'subscription_details',
            subscription_details: {
              subscription: 'sub_teste',
              metadata: { cycle: 'ANNUAL', user_id: userId },
            },
          },
          lines: {
            data: [{ period: { start: INICIO, end: FIM_DO_CICLO }, metadata: { cycle: 'ANNUAL', user_id: userId } }],
          },
        },
      },
    },
  }
}

function assinaturaAtualizada(userId: string, status: string) {
  return {
    id: `evt_assinatura_${status}`,
    type: 'customer.subscription.updated',
    payload: {
      data: {
        object: {
          object: 'subscription',
          id: 'sub_teste',
          customer: 'cus_teste',
          status,
          // Na API nova o fim do ciclo mora no item, e não no topo.
          items: { data: [{ current_period_end: FIM_DO_CICLO }] },
          metadata: { cycle: 'ANNUAL', user_id: userId },
        },
      },
    },
  }
}

async function pessoa(): Promise<AuthenticatedUser> {
  const criada = await createUser('Assinante')
  return { id: criada.id, email: criada.email, name: 'Assinante', plan: 'FREE', premiumUntil: null }
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('o formato da API nova', () => {
  /* O caso exato de 21/09: a fatura chega primeiro, e sozinha. */
  it('libera o Premium pela fatura, mesmo sem a sessão ter chegado', async () => {
    const ana = await pessoa()

    const outcome = await handlePaymentEvent(testPrisma(), faturaPaga(String(ana.id)))

    expect(outcome.userId).toBe(ana.id)
    const depois = await testPrisma().user.findUniqueOrThrow({ where: { id: ana.id } })
    expect(depois.plan).toBe('PREMIUM')
    expect(depois.premiumUntil).toEqual(new Date(FIM_DO_CICLO * 1000))
    const assinatura = await testPrisma().subscription.findFirstOrThrow({ where: { userId: ana.id } })
    expect(assinatura).toMatchObject({ status: 'ACTIVE', cycle: 'ANNUAL', subscriptionId: 'sub_teste' })
  })

  /*
   * `invoice.period_end` é o fim do período **daquela fatura**, que no primeiro
   * pagamento é o mesmo instante do começo. Usá-lo daria Premium vencido no
   * mesmo segundo — por isso a data sai da linha.
   */
  it('usa o fim da linha, e não o período da fatura', async () => {
    const ana = await pessoa()

    await handlePaymentEvent(testPrisma(), faturaPaga(String(ana.id)))

    const depois = await testPrisma().user.findUniqueOrThrow({ where: { id: ana.id } })
    expect(depois.premiumUntil).not.toEqual(new Date(INICIO * 1000))
  })

  it('lê o fim do ciclo dentro do item da assinatura', async () => {
    const ana = await pessoa()

    await handlePaymentEvent(testPrisma(), assinaturaAtualizada(String(ana.id), 'active'))

    const depois = await testPrisma().user.findUniqueOrThrow({ where: { id: ana.id } })
    expect(depois.premiumUntil).toEqual(new Date(FIM_DO_CICLO * 1000))
  })

  /* A ficha é uma só: a fatura e a assinatura falam do mesmo `sub_teste`. */
  it('não duplica a ficha quando os dois avisos chegam', async () => {
    const ana = await pessoa()

    await handlePaymentEvent(testPrisma(), faturaPaga(String(ana.id)))
    await handlePaymentEvent(testPrisma(), assinaturaAtualizada(String(ana.id), 'active'))

    expect(await testPrisma().subscription.count({ where: { userId: ana.id } })).toBe(1)
  })
})
