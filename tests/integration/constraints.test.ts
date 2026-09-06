import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createCard,
  createCardWithVariant,
  createStorage,
  createUser,
  createVariant,
  disconnect,
  own,
  resetDatabase,
  testPrisma,
} from '../helpers'

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('tipo e proposito de armazenamento', () => {
  it.each([
    ['BINDER', 'COLLECTION'],
    ['BINDER', 'TRADE'],
    ['BOX', 'COLLECTION'],
    // Teste obrigatorio 5: BOX + TRADE e valido.
    ['BOX', 'TRADE'],
  ] as const)('aceita %s com proposito %s', async (type, purpose) => {
    const user = await createUser()
    const storage = await createStorage(user.id, type, purpose)
    expect(storage.type).toBe(type)
    expect(storage.purpose).toBe(purpose)
  })

  it('aceita DECK sem proposito', async () => {
    const user = await createUser()
    const deck = await createStorage(user.id, 'DECK', null, 'Meu deck')
    expect(deck.purpose).toBeNull()
  })

  it('rejeita DECK com proposito', async () => {
    const user = await createUser()
    await expect(createStorage(user.id, 'DECK', 'COLLECTION')).rejects.toThrow()
  })

  it('rejeita BINDER sem proposito', async () => {
    const user = await createUser()
    await expect(createStorage(user.id, 'BINDER', null)).rejects.toThrow()
  })

  it('rejeita BOX sem proposito', async () => {
    const user = await createUser()
    await expect(createStorage(user.id, 'BOX', null)).rejects.toThrow()
  })
})

describe('quantidades', () => {
  it('rejeita quantidade zero na colecao', async () => {
    const user = await createUser()
    const { variant } = await createCardWithVariant()
    await expect(own(user.collection!.id, variant.id, 0)).rejects.toThrow()
  })

  it('rejeita quantidade negativa na colecao', async () => {
    const user = await createUser()
    const { variant } = await createCardWithVariant()
    await expect(own(user.collection!.id, variant.id, -1)).rejects.toThrow()
  })

  it('rejeita want com quantidade zero', async () => {
    const user = await createUser()
    const { variant } = await createCardWithVariant()
    await expect(
      testPrisma().wantItem.create({
        data: { userId: user.id, cardVariantId: variant.id, quantity: 0 },
      }),
    ).rejects.toThrow()
  })

  it('rejeita preco negativo', async () => {
    const { variant } = await createCardWithVariant()
    await expect(
      testPrisma().cardPrice.create({
        data: { cardVariantId: variant.id, value: -1, capturedAt: new Date() },
      }),
    ).rejects.toThrow()
  })
})

describe('vocabulario fechado', () => {
  it('aceita os quatro tipos de carta', async () => {
    for (const type of ['Leader', 'Character', 'Event', 'Stage'] as const) {
      const card = await createCard(type)
      expect(card.type).toBe(type)
    }
  })

  it('rejeita tipo de carta desconhecido', async () => {
    // DON!! esta fora do catalogo nesta versao.
    await expect(
      testPrisma().card.create({
        data: { code: 'DON-001', name: 'DON!!', type: 'Don' },
      }),
    ).rejects.toThrow()
  })

  it('rejeita status de trade desconhecido', async () => {
    await expect(
      testPrisma().trade.create({ data: { status: 'ACEITO' } }),
    ).rejects.toThrow()
  })

  it('rejeita plano desconhecido', async () => {
    await expect(
      testPrisma().user.create({
        data: {
          name: 'x',
          email: 'plano@example.test',
          plan: 'GOLD',
        },
      }),
    ).rejects.toThrow()
  })
})

describe('consistencia de completed_at do trade', () => {
  it('rejeita COMPLETED sem completed_at', async () => {
    await expect(
      testPrisma().trade.create({ data: { status: 'COMPLETED' } }),
    ).rejects.toThrow()
  })

  it('rejeita completed_at em trade que nao esta COMPLETED', async () => {
    await expect(
      testPrisma().trade.create({
        data: { status: 'NEGOTIATING', completedAt: new Date() },
      }),
    ).rejects.toThrow()
  })

  it('aceita COMPLETED com completed_at', async () => {
    const trade = await testPrisma().trade.create({
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
    expect(trade.completedAt).not.toBeNull()
  })
})

describe('unicidade', () => {
  it('impede dois usuarios com o mesmo e-mail', async () => {
    const db = testPrisma()
    await db.user.create({
      data: { name: 'a', email: 'igual@example.test' },
    })
    await expect(
      db.user.create({
        data: { name: 'b', email: 'igual@example.test' },
      }),
    ).rejects.toThrow()
  })

  it('impede duas colecoes para o mesmo usuario', async () => {
    const user = await createUser()
    await expect(
      testPrisma().collection.create({
        data: { userId: user.id, name: 'Segunda' },
      }),
    ).rejects.toThrow()
  })

  it('impede duas linhas de posse da mesma variante', async () => {
    const user = await createUser()
    const { variant } = await createCardWithVariant()
    await own(user.collection!.id, variant.id, 1)
    await expect(own(user.collection!.id, variant.id, 1)).rejects.toThrow()
  })

  it('impede duas alocacoes do mesmo item no mesmo armazenamento', async () => {
    const db = testPrisma()
    const user = await createUser()
    const { variant } = await createCardWithVariant()
    const item = await own(user.collection!.id, variant.id, 4)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')

    await db.collectionItemLocation.create({
      data: { collectionItemId: item.id, storageLocationId: binder.id, quantity: 1 },
    })
    await expect(
      db.collectionItemLocation.create({
        data: { collectionItemId: item.id, storageLocationId: binder.id, quantity: 1 },
      }),
    ).rejects.toThrow()
  })

  it('impede o mesmo usuario duas vezes no mesmo trade', async () => {
    const db = testPrisma()
    const user = await createUser()
    const trade = await db.trade.create({ data: { status: 'DRAFT' } })
    await db.tradeParticipant.create({
      data: { tradeId: trade.id, userId: user.id, role: 'INITIATOR' },
    })
    await expect(
      db.tradeParticipant.create({
        data: { tradeId: trade.id, userId: user.id, role: 'COUNTERPARTY' },
      }),
    ).rejects.toThrow()
  })
})

describe('identidade de variante', () => {
  it('permite duas alternate arts distintas da mesma carta', async () => {
    // Este e o caso que impede (card_id, variant_type) de ser chave natural,
    // e por isso a importacao idempotente depende de um id externo.
    const card = await createCard()
    const first = await createVariant(card.id, 'Alternate Art')
    const second = await createVariant(card.id, 'Alternate Art')
    expect(first.id).not.toBe(second.id)
  })

  it('trata Normal, Alternate Art e Manga como variantes distintas', async () => {
    const card = await createCard()
    const variants = await Promise.all([
      createVariant(card.id, 'Normal'),
      createVariant(card.id, 'Alternate Art'),
      createVariant(card.id, 'Manga'),
    ])
    expect(new Set(variants.map((v) => v.id)).size).toBe(3)
  })
})

describe('historico de precos', () => {
  it('impede duas capturas da mesma variante no mesmo instante', async () => {
    // Sem isto, reexecutar a importacao de precos duplicaria o historico, e o
    // valor historico de um trade dependeria de qual linha a consulta pegasse.
    const db = testPrisma()
    const { variant } = await createCardWithVariant()
    const capturedAt = new Date('2026-09-06T12:00:00.000Z')

    await db.cardPrice.create({
      data: { cardVariantId: variant.id, value: 100, capturedAt },
    })
    await expect(
      db.cardPrice.create({
        data: { cardVariantId: variant.id, value: 150, capturedAt },
      }),
    ).rejects.toThrow()
  })

  it('aceita capturas em instantes diferentes', async () => {
    const db = testPrisma()
    const { variant } = await createCardWithVariant()

    await db.cardPrice.create({
      data: {
        cardVariantId: variant.id,
        value: 100,
        capturedAt: new Date('2026-09-06T12:00:00.000Z'),
      },
    })
    await db.cardPrice.create({
      data: {
        cardVariantId: variant.id,
        value: 150,
        capturedAt: new Date('2026-09-07T12:00:00.000Z'),
      },
    })

    expect(await db.cardPrice.count()).toBe(2)
  })

  it('aceita a mesma captura para variantes diferentes', async () => {
    const db = testPrisma()
    const first = await createCardWithVariant()
    const second = await createCardWithVariant()
    const capturedAt = new Date('2026-09-06T12:00:00.000Z')

    await db.cardPrice.create({
      data: { cardVariantId: first.variant.id, value: 100, capturedAt },
    })
    await db.cardPrice.create({
      data: { cardVariantId: second.variant.id, value: 100, capturedAt },
    })

    expect(await db.cardPrice.count()).toBe(2)
  })
})
