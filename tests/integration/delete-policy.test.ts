import { afterAll, beforeEach, describe, expect, it } from 'vitest'
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

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('dados proprios do usuario cascateiam', () => {
  it('excluir o usuario remove colecao, itens, armazenamentos e wants', async () => {
    const db = testPrisma()
    const user = await createUser()
    const { variant } = await createCardWithVariant()
    const item = await own(user.collection!.id, variant.id, 2)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')
    await allocate(item.id, binder.id, 1)
    await db.wantItem.create({
      data: { userId: user.id, cardVariantId: variant.id, quantity: 1 },
    })

    await db.user.delete({ where: { id: user.id } })

    expect(await db.collection.count()).toBe(0)
    expect(await db.collectionItem.count()).toBe(0)
    expect(await db.collectionItemLocation.count()).toBe(0)
    expect(await db.storageLocation.count()).toBe(0)
    expect(await db.wantItem.count()).toBe(0)
    // O catalogo nao e afetado por exclusao de usuario.
    expect(await db.cardVariant.count()).toBe(1)
  })

  it('excluir um armazenamento libera as alocacoes mas preserva a posse', async () => {
    const db = testPrisma()
    const user = await createUser()
    const { variant } = await createCardWithVariant()
    const item = await own(user.collection!.id, variant.id, 3)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')
    await allocate(item.id, binder.id, 3)

    await db.storageLocation.delete({ where: { id: binder.id } })

    expect(await db.collectionItemLocation.count()).toBe(0)
    const kept = await db.collectionItem.findUniqueOrThrow({ where: { id: item.id } })
    expect(kept.quantity).toBe(3)
  })
})

describe('historico e catalogo sao protegidos', () => {
  it('bloqueia excluir usuario que participa de um trade', async () => {
    // Esta e a razao de contas serem anonimizadas em vez de excluidas
    // (decisao 015): apagar o usuario destruiria metade do trade do outro lado.
    const db = testPrisma()
    const user = await createUser()
    const trade = await db.trade.create({ data: { status: 'DRAFT' } })
    await db.tradeParticipant.create({
      data: { tradeId: trade.id, userId: user.id, role: 'INITIATOR' },
    })

    await expect(db.user.delete({ where: { id: user.id } })).rejects.toThrow()
    expect(await db.user.count()).toBe(1)
  })

  it('bloqueia excluir variante que alguem possui', async () => {
    const db = testPrisma()
    const user = await createUser()
    const { variant } = await createCardWithVariant()
    await own(user.collection!.id, variant.id, 1)

    await expect(
      db.cardVariant.delete({ where: { id: variant.id } }),
    ).rejects.toThrow()
  })

  it('bloqueia excluir variante com historico de preco', async () => {
    const db = testPrisma()
    const { variant } = await createCardWithVariant()
    await db.cardPrice.create({
      data: { cardVariantId: variant.id, value: 100, capturedAt: new Date() },
    })

    await expect(
      db.cardVariant.delete({ where: { id: variant.id } }),
    ).rejects.toThrow()
  })

  it('bloqueia excluir carta que possui variantes', async () => {
    const db = testPrisma()
    const { card } = await createCardWithVariant()
    await expect(db.card.delete({ where: { id: card.id } })).rejects.toThrow()
  })

  it('bloqueia excluir set que possui impressoes', async () => {
    const db = testPrisma()
    const { variant } = await createCardWithVariant()
    const set = await db.set.create({ data: { code: 'OP01', name: 'Romance Dawn' } })
    await db.variantPrinting.create({
      data: { cardVariantId: variant.id, setId: set.id },
    })

    await expect(db.set.delete({ where: { id: set.id } })).rejects.toThrow()
  })

  it('bloqueia excluir cor em uso por alguma carta', async () => {
    const db = testPrisma()
    const { card } = await createCardWithVariant()
    const color = await db.color.create({ data: { name: 'Red' } })
    await db.cardColor.create({ data: { cardId: card.id, colorId: color.id } })

    await expect(db.color.delete({ where: { id: color.id } })).rejects.toThrow()
  })
})

describe('anonimizacao preserva o outro lado do trade', () => {
  it('mantem o trade completo depois de anonimizar um participante', async () => {
    const db = testPrisma()
    const leaving = await createUser('Quem sai')
    const staying = await createUser('Quem fica')
    const { variant } = await createCardWithVariant()

    const trade = await db.trade.create({
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
    const leavingParticipant = await db.tradeParticipant.create({
      data: { tradeId: trade.id, userId: leaving.id, role: 'INITIATOR' },
    })
    await db.tradeParticipant.create({
      data: { tradeId: trade.id, userId: staying.id, role: 'COUNTERPARTY' },
    })
    await db.tradeItem.create({
      data: {
        tradeParticipantId: leavingParticipant.id,
        cardVariantId: variant.id,
        quantity: 2,
      },
    })

    // Anonimizacao conforme a decisao 015.
    await db.$transaction(async (tx) => {
      await tx.collection.deleteMany({ where: { userId: leaving.id } })
      await tx.storageLocation.deleteMany({ where: { userId: leaving.id } })
      await tx.wantItem.deleteMany({ where: { userId: leaving.id } })
      await tx.user.update({
        where: { id: leaving.id },
        data: {
          name: 'Usuario removido',
          email: `deleted+${leaving.id}@deleted.invalid`,
          passwordHash: '!',
          plan: 'FREE',
          trialStartedAt: null,
          premiumUntil: null,
          deletedAt: new Date(),
        },
      })
    })

    const anonymised = await db.user.findUniqueOrThrow({ where: { id: leaving.id } })
    expect(anonymised.deletedAt).not.toBeNull()
    expect(anonymised.email).toBe(`deleted+${leaving.id}@deleted.invalid`)

    // O trade continua com os dois lados e com os itens intactos.
    const participants = await db.tradeParticipant.findMany({
      where: { tradeId: trade.id },
      include: { items: true },
    })
    expect(participants).toHaveLength(2)
    expect(participants.flatMap((p) => p.items)).toHaveLength(1)
  })
})
