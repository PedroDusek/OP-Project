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

/** Copias em armazenamento cujo proposito e TRADE. Decks e COLLECTION nao contam. */
async function tradeAvailable(collectionItemId: bigint): Promise<number> {
  const rows = await testPrisma().$queryRawUnsafe<{ total: bigint }[]>(
    `SELECT COALESCE(SUM(cil.quantity), 0)::bigint AS total
     FROM collection_item_locations cil
     JOIN storage_locations sl ON sl.id = cil.storage_location_id
     WHERE cil.collection_item_id = $1
       AND sl.purpose = 'TRADE'`,
    collectionItemId,
  )
  return Number(rows[0].total)
}

describe('soma das alocacoes contra a quantidade possuida', () => {
  it('teste obrigatorio 7: possui 4, binder 3 + box 2 e rejeitado', async () => {
    const user = await createUser()
    const { variant } = await createCardWithVariant()
    const item = await own(user.collection!.id, variant.id, 4)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')
    const box = await createStorage(user.id, 'BOX', 'COLLECTION')

    await allocate(item.id, binder.id, 3)
    await expect(allocate(item.id, box.id, 2)).rejects.toThrow()

    // A alocacao rejeitada nao pode ter deixado residuo.
    const total = await testPrisma().collectionItemLocation.aggregate({
      where: { collectionItemId: item.id },
      _sum: { quantity: true },
    })
    expect(total._sum.quantity).toBe(3)
  })

  it('aceita soma exatamente igual a quantidade possuida', async () => {
    const user = await createUser()
    const { variant } = await createCardWithVariant()
    const item = await own(user.collection!.id, variant.id, 4)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')
    const box = await createStorage(user.id, 'BOX', 'COLLECTION')

    await allocate(item.id, binder.id, 3)
    await allocate(item.id, box.id, 1)

    const total = await testPrisma().collectionItemLocation.aggregate({
      where: { collectionItemId: item.id },
      _sum: { quantity: true },
    })
    expect(total._sum.quantity).toBe(4)
  })

  it('aceita soma menor que a quantidade possuida', async () => {
    // Copias sem localizacao registrada sao normais. Nao existe "Unallocated".
    const user = await createUser()
    const { variant } = await createCardWithVariant()
    const item = await own(user.collection!.id, variant.id, 10)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')

    await allocate(item.id, binder.id, 2)

    const total = await testPrisma().collectionItemLocation.aggregate({
      where: { collectionItemId: item.id },
      _sum: { quantity: true },
    })
    expect(total._sum.quantity).toBe(2)
  })

  it('rejeita aumentar uma alocacao existente alem do possuido', async () => {
    const user = await createUser()
    const { variant } = await createCardWithVariant()
    const item = await own(user.collection!.id, variant.id, 4)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')
    const location = await allocate(item.id, binder.id, 4)

    await expect(
      testPrisma().collectionItemLocation.update({
        where: { id: location.id },
        data: { quantity: 5 },
      }),
    ).rejects.toThrow()
  })
})

describe('reduzir a quantidade possuida', () => {
  it('rejeita reduzir abaixo do que ja esta alocado', async () => {
    const user = await createUser()
    const { variant } = await createCardWithVariant()
    const item = await own(user.collection!.id, variant.id, 4)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')
    const box = await createStorage(user.id, 'BOX', 'COLLECTION')
    await allocate(item.id, binder.id, 3)
    await allocate(item.id, box.id, 1)

    await expect(
      testPrisma().collectionItem.update({
        where: { id: item.id },
        data: { quantity: 2 },
      }),
    ).rejects.toThrow()
  })

  it('aceita reduzir ate o total alocado', async () => {
    const user = await createUser()
    const { variant } = await createCardWithVariant()
    const item = await own(user.collection!.id, variant.id, 4)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')
    await allocate(item.id, binder.id, 2)

    const updated = await testPrisma().collectionItem.update({
      where: { id: item.id },
      data: { quantity: 2 },
    })
    expect(updated.quantity).toBe(2)
  })

  it('aceita aumentar a quantidade a qualquer momento', async () => {
    const user = await createUser()
    const { variant } = await createCardWithVariant()
    const item = await own(user.collection!.id, variant.id, 2)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')
    await allocate(item.id, binder.id, 2)

    const updated = await testPrisma().collectionItem.update({
      where: { id: item.id },
      data: { quantity: 5 },
    })
    expect(updated.quantity).toBe(5)
  })
})

describe('propriedade do armazenamento', () => {
  it('rejeita alocar em armazenamento de outro usuario', async () => {
    const owner = await createUser('Dono')
    const stranger = await createUser('Estranho')
    const { variant } = await createCardWithVariant()
    const item = await own(owner.collection!.id, variant.id, 4)
    const foreignBinder = await createStorage(stranger.id, 'BINDER', 'COLLECTION')

    await expect(allocate(item.id, foreignBinder.id, 1)).rejects.toThrow()
  })
})

describe('disponibilidade para troca', () => {
  it('teste obrigatorio 4: possui 5 distribuidas, disponivel para troca e 1', async () => {
    const user = await createUser()
    const { variant } = await createCardWithVariant()
    const item = await own(user.collection!.id, variant.id, 5)

    const collectionBinder = await createStorage(user.id, 'BINDER', 'COLLECTION')
    const collectionBox = await createStorage(user.id, 'BOX', 'COLLECTION')
    const tradeBox = await createStorage(user.id, 'BOX', 'TRADE')
    const deck = await createStorage(user.id, 'DECK', null)

    await allocate(item.id, collectionBinder.id, 2)
    await allocate(item.id, collectionBox.id, 1)
    await allocate(item.id, tradeBox.id, 1)
    await allocate(item.id, deck.id, 1)

    // Teste obrigatorio 6: a copia no deck continua contando na colecao.
    const reloaded = await testPrisma().collectionItem.findUniqueOrThrow({
      where: { id: item.id },
    })
    expect(reloaded.quantity).toBe(5)

    expect(await tradeAvailable(item.id)).toBe(1)
  })

  it('conta binder de troca e box de troca juntos', async () => {
    const user = await createUser()
    const { variant } = await createCardWithVariant()
    const item = await own(user.collection!.id, variant.id, 6)
    const tradeBinder = await createStorage(user.id, 'BINDER', 'TRADE')
    const tradeBox = await createStorage(user.id, 'BOX', 'TRADE')
    const deck = await createStorage(user.id, 'DECK', null)

    await allocate(item.id, tradeBinder.id, 2)
    await allocate(item.id, tradeBox.id, 3)
    await allocate(item.id, deck.id, 1)

    expect(await tradeAvailable(item.id)).toBe(5)
  })

  it('nao conta copias sem localizacao registrada', async () => {
    const user = await createUser()
    const { variant } = await createCardWithVariant()
    const item = await own(user.collection!.id, variant.id, 4)

    expect(await tradeAvailable(item.id)).toBe(0)
  })
})
