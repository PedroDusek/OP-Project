import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { AuthenticatedUser } from '@/server/application/auth'
import { PREMIUM_REQUIRED } from '@/server/application/authorization'
import { readDashboard } from '@/server/application/collection/read-collection'
import { publishTradeBinder, readPublicTradeBinder } from '@/server/application/trades/public-binder'
import { acceptInvite, inviteMember, joinTrade, startTrade } from '@/server/application/trades/start-trade'
import { startConversation } from '@/server/application/social/conversations'
import { resetRateLimits } from '@/server/http/rate-limit'
import {
  allocate,
  createCardWithVariant,
  createStorage,
  createUser,
  disconnect,
  own,
  resetDatabase,
  testPrisma,
} from '../helpers'

/**
 * O que é Premium e o que é Free (decisão 093).
 *
 * Regras do dono do produto: publicar o Trade Binder, **começar** uma troca e a
 * análise da coleção são Premium; entrar numa troca, conversar e ver o total de
 * cartas são de todos.
 */

const AMANHA = new Date(Date.now() + 24 * 60 * 60 * 1000)
const ONTEM = new Date(Date.now() - 24 * 60 * 60 * 1000)

async function pessoa(
  nome: string,
  username: string,
  plano: { plan: string; premiumUntil?: Date | null } = { plan: 'FREE' },
): Promise<AuthenticatedUser & { collectionId: bigint }> {
  const criada = await createUser(nome)
  await testPrisma().user.update({
    where: { id: criada.id },
    data: { username, plan: plano.plan, premiumUntil: plano.premiumUntil ?? null },
  })
  return {
    id: criada.id,
    email: criada.email,
    name: nome,
    plan: plano.plan,
    premiumUntil: plano.premiumUntil ?? null,
    collectionId: criada.collection!.id,
  }
}

/** Uma carta em local de troca, que é o que o Trade Binder mostra. */
async function comCartaParaTroca(dono: { id: bigint; collectionId: bigint }) {
  const { variant } = await createCardWithVariant()
  const local = await createStorage(dono.id, 'BINDER', 'TRADE')
  const item = await own(dono.collectionId, variant.id, 2)
  await allocate(item.id, local.id, 2)
  return variant
}

beforeEach(async () => {
  await resetDatabase()
  resetRateLimits()
})

afterAll(async () => {
  await disconnect()
})

describe('publicar o Trade Binder', () => {
  it('Premium publica; Free recebe o aviso do Premium e nada é publicado', async () => {
    const premium = await pessoa('Premium', 'premium', { plan: 'PREMIUM', premiumUntil: AMANHA })
    const free = await pessoa('Free', 'free')
    await comCartaParaTroca(premium)
    await comCartaParaTroca(free)

    const { token } = await publishTradeBinder(testPrisma(), premium)
    expect(await readPublicTradeBinder(testPrisma(), token!)).toMatchObject({ username: 'premium' })

    const erro = await publishTradeBinder(testPrisma(), free).catch((e) => e)
    expect(erro).toMatchObject({ code: PREMIUM_REQUIRED })
    expect(erro.message).toMatch(/Premium/)
    expect((await testPrisma().user.findUniqueOrThrow({ where: { id: free.id } })).tradeBinderToken).toBeNull()
  })

  it('Premium vencido é Free', async () => {
    const vencido = await pessoa('Vencido', 'vencido', { plan: 'PREMIUM', premiumUntil: ONTEM })
    await expect(publishTradeBinder(testPrisma(), vencido)).rejects.toMatchObject({ code: PREMIUM_REQUIRED })
  })
})

describe('começar uma troca', () => {
  it('só Premium começa, pelo link ou pelo convite', async () => {
    const free = await pessoa('Free', 'free')
    const premium = await pessoa('Premium', 'premium', { plan: 'PREMIUM', premiumUntil: AMANHA })

    await expect(startTrade(testPrisma(), free)).rejects.toMatchObject({ code: PREMIUM_REQUIRED })
    await expect(inviteMember(testPrisma(), free, 'premium')).rejects.toMatchObject({ code: PREMIUM_REQUIRED })
    expect(await testPrisma().trade.count()).toBe(0)

    const { inviteToken } = await startTrade(testPrisma(), premium)
    expect(inviteToken).toBeTruthy()
  })

  it('Free entra na troca por link e aceita convite', async () => {
    const premium = await pessoa('Premium', 'premium', { plan: 'PREMIUM', premiumUntil: AMANHA })
    const free = await pessoa('Free', 'free')

    const { inviteToken } = await startTrade(testPrisma(), premium)
    const tradeId = await joinTrade(testPrisma(), free, inviteToken!)
    expect(tradeId).toBeTruthy()
    expect((await testPrisma().trade.findUniqueOrThrow({ where: { id: tradeId } })).status).toBe('NEGOTIATING')

    // E pelo convite direto, que quem convida precisa ser Premium.
    await testPrisma().trade.updateMany({ data: { status: 'CANCELLED', inviteToken: null } })
    const convite = await inviteMember(testPrisma(), premium, 'free')
    await acceptInvite(testPrisma(), free, convite)
    expect((await testPrisma().trade.findUniqueOrThrow({ where: { id: convite } })).status).toBe('NEGOTIATING')
  })

  it('conversar continua de todos', async () => {
    const free = await pessoa('Free', 'free')
    await pessoa('Outra', 'outra')
    await expect(startConversation(testPrisma(), free, 'outra')).resolves.toBeTruthy()
  })
})

describe('o Início', () => {
  it('Free vê só o total de cartas; Premium vê a análise', async () => {
    const free = await pessoa('Free', 'free')
    const premium = await pessoa('Premium', 'premium', { plan: 'PREMIUM', premiumUntil: AMANHA })
    const { variant } = await createCardWithVariant()
    await own(free.collectionId, variant.id, 4)
    await own(premium.collectionId, variant.id, 4)

    expect(await readDashboard(testPrisma(), free)).toEqual({
      totalCards: 4,
      premium: false,
      uniqueVariants: null,
      closedPlaysets: null,
      catalogVariants: null,
    })

    const doPremium = await readDashboard(testPrisma(), premium)
    expect(doPremium).toMatchObject({ totalCards: 4, premium: true, uniqueVariants: 1, closedPlaysets: 1 })
    expect(doPremium.catalogVariants).toBeGreaterThan(0)
  })

  it('coleção vazia não quebra em nenhum dos planos', async () => {
    const free = await pessoa('Free', 'free')
    const premium = await pessoa('Premium', 'premium', { plan: 'PREMIUM', premiumUntil: AMANHA })

    expect(await readDashboard(testPrisma(), free)).toMatchObject({ totalCards: 0, premium: false })
    expect(await readDashboard(testPrisma(), premium)).toMatchObject({ totalCards: 0, premium: true })
  })
})
