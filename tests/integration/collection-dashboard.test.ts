import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { AuthenticatedUser } from '@/server/application/auth'
import { PREMIUM_REQUIRED } from '@/server/application/authorization'
import { readCollectionDashboard } from '@/server/application/collection/dashboard'
import { createUser, disconnect, own, resetDatabase, testPrisma } from '../helpers'

/**
 * O dashboard lendo do banco (decisão 098). As contas estão testadas no domínio;
 * aqui se confere o que só o banco mostra: a trava do Premium, o filtro pelo
 * código da coleção, o preço mais recente e a cotação.
 */

const AMANHA = new Date(Date.now() + 24 * 60 * 60 * 1000)

async function pessoa(premium = true): Promise<AuthenticatedUser & { collectionId: bigint }> {
  const criada = await createUser('Colecionadora')
  return {
    id: criada.id,
    email: criada.email,
    name: 'Colecionadora',
    plan: premium ? 'PREMIUM' : 'FREE',
    premiumUntil: premium ? AMANHA : null,
    collectionId: criada.collection!.id,
  }
}

async function carta(code: string, setCodes: string[]) {
  const sets = await Promise.all(
    setCodes.map((setCode) =>
      testPrisma().set.upsert({ where: { code: setCode }, create: { code: setCode, name: setCode }, update: {} }),
    ),
  )
  const card = await testPrisma().card.create({
    data: {
      code,
      name: `Carta ${code}`,
      type: 'Character',
      variants: {
        create: { variantType: 'Normal', rarity: 'SR', printings: { create: sets.map((set) => ({ setId: set.id })) } },
      },
    },
    include: { variants: true },
  })
  return card.variants[0]
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('readCollectionDashboard', () => {
  it('é Premium', async () => {
    const free = await pessoa(false)
    await expect(readCollectionDashboard(testPrisma(), free)).rejects.toMatchObject({ code: PREMIUM_REQUIRED })
  })

  /*
   * A linha de `a` valia 1 ontem e vale 3 hoje. Antes da decisão 107 as duas
   * coexistiam e o teste provava que o dashboard pegava a mais recente; agora
   * `card_prices` tem **uma linha por variante**, e o preço de ontem não existe
   * mais em lugar nenhum. O que se protege aqui passou a ser a conta: 2×3 + 10.
   */
  it('usa o preço de hoje, a cotação do dia, e filtra pelo código da coleção', async () => {
    const dona = await pessoa()
    const a = await carta('OP01-010', ['OP-01'])
    const b = await carta('OP02-010', ['OP-02'])
    await own(dona.collectionId, a.id, 2)
    await own(dona.collectionId, b.id, 1)

    await testPrisma().cardPrice.createMany({
      data: [
        { cardVariantId: a.id, value: 3, capturedAt: new Date() },
        { cardVariantId: b.id, value: 10, capturedAt: new Date() },
      ],
    })
    await testPrisma().exchangeRate.create({
      data: { baseCurrency: 'USD', quoteCurrency: 'BRL', rate: 5, quoteDate: new Date(), source: 'teste' },
    })

    const tudo = await readCollectionDashboard(testPrisma(), dona)
    expect(tudo.totalValueUsd).toBe(16)
    expect(tudo.rate).toBe(5)
    expect(tudo.bySet.map((s) => s.set.code)).toEqual(expect.arrayContaining(['OP-01', 'OP-02']))

    const op01 = await readCollectionDashboard(testPrisma(), dona, { setCode: 'OP-01' })
    expect(op01.totalValueUsd).toBe(6)
    expect(op01.bySet.map((s) => s.set.code)).toEqual(['OP-01'])
    // O valor do topo do Inicio e da colecao inteira: o filtro nao mexe nele.
    expect(op01.overallValueUsd).toBe(16)
    expect(tudo.overallValueUsd).toBe(16)

    // Codigo que nao existe e filtro nenhum, e nao uma tela vazia.
    const inventado = await readCollectionDashboard(testPrisma(), dona, { setCode: 'NAO-EXISTE' })
    expect(inventado.totalValueUsd).toBe(16)
  })
})
