import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  countCopies,
  listTradeBinder,
} from '@/server/application/trades/read-trade-binder'
import type { AuthenticatedUser } from '@/server/application/auth'
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
 * O Trade Binder contra o banco.
 *
 * O que se protege aqui e a fronteira do que conta como disponivel
 * (`business-rules.md` 4.1): so armazenamento com finalidade `TRADE`. Colecao e
 * deck ficam de fora, e continuam integralmente na colecao.
 *
 * A aritmetica de match esta em `tests/domain/wants.test.ts`. Aqui e escopo por
 * dono e soma entre locais.
 */

type Owner = { user: AuthenticatedUser; collectionId: bigint; userId: bigint }

async function owner(name = 'Dono'): Promise<Owner> {
  const created = await createUser(name)
  return {
    userId: created.id,
    collectionId: created.collection!.id,
    user: {
      id: created.id,
      email: `${name.toLowerCase()}@example.test`,
      name,
      plan: 'FREE',
      premiumUntil: null,
    },
  }
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('o que conta como disponivel', () => {
  it('soma as copias em local de troca', async () => {
    const dono = await owner()
    const { variant } = await createCardWithVariant()
    const item = await own(dono.collectionId, variant.id, 4)
    const troca = await createStorage(dono.userId, 'BINDER', 'TRADE')
    await allocate(item.id, troca.id, 3)

    const binder = await listTradeBinder(testPrisma(), dono.user)

    expect(binder).toHaveLength(1)
    expect(binder[0]).toMatchObject({ quantity: 3, ownedQuantity: 4, locationCount: 1 })
  })

  /** Guardado nao e o mesmo que a disposicao. */
  it('ignora local de colecao', async () => {
    const dono = await owner()
    const { variant } = await createCardWithVariant()
    const item = await own(dono.collectionId, variant.id, 4)
    const colecao = await createStorage(dono.userId, 'BINDER', 'COLLECTION')
    await allocate(item.id, colecao.id, 4)

    expect(await listTradeBinder(testPrisma(), dono.user)).toEqual([])
  })

  /**
   * Deck nunca abastece o Trade Binder: as copias estao num deck montado. Hoje
   * deck nem pode ter finalidade — e `CHECK` no banco —, e este teste existe
   * para o dia em que aquele `CHECK` afrouxar.
   */
  it('ignora deck', async () => {
    const dono = await owner()
    const { variant } = await createCardWithVariant()
    const item = await own(dono.collectionId, variant.id, 4)
    const deck = await createStorage(dono.userId, 'DECK', null)
    await allocate(item.id, deck.id, 4)

    expect(await listTradeBinder(testPrisma(), dono.user)).toEqual([])
  })

  it('nao mostra carta que a pessoa tem mas nao alocou em troca', async () => {
    const dono = await owner()
    const { variant } = await createCardWithVariant()
    await own(dono.collectionId, variant.id, 4)

    expect(await listTradeBinder(testPrisma(), dono.user)).toEqual([])
  })
})

describe('copias espalhadas', () => {
  /**
   * Importa na regra 4.6: com as copias num lugar so, de onde elas saem e
   * deducao; espalhadas, o trade precisa perguntar. A tela avisa antes.
   */
  it('soma entre locais de troca e conta quantos sao', async () => {
    const dono = await owner()
    const { variant } = await createCardWithVariant()
    const item = await own(dono.collectionId, variant.id, 4)
    const um = await createStorage(dono.userId, 'BINDER', 'TRADE', 'Troca 1')
    const dois = await createStorage(dono.userId, 'BOX', 'TRADE', 'Troca 2')
    await allocate(item.id, um.id, 1)
    await allocate(item.id, dois.id, 2)

    const binder = await listTradeBinder(testPrisma(), dono.user)

    expect(binder[0]).toMatchObject({ quantity: 3, locationCount: 2 })
  })

  it('conta um local so quando as copias estao juntas', async () => {
    const dono = await owner()
    const { variant } = await createCardWithVariant()
    const item = await own(dono.collectionId, variant.id, 2)
    const troca = await createStorage(dono.userId, 'BINDER', 'TRADE')
    await allocate(item.id, troca.id, 2)

    expect((await listTradeBinder(testPrisma(), dono.user))[0].locationCount).toBe(1)
  })
})

describe('escopo por dono', () => {
  /** Regra 6.2: ninguem le recurso privado de outra pessoa. */
  it('nao mostra o Trade Binder de outra pessoa', async () => {
    const dono = await owner('Dono')
    const outro = await owner('Outro')
    const { variant } = await createCardWithVariant()
    const item = await own(outro.collectionId, variant.id, 3)
    const troca = await createStorage(outro.userId, 'BINDER', 'TRADE')
    await allocate(item.id, troca.id, 3)

    expect(await listTradeBinder(testPrisma(), dono.user)).toEqual([])
    expect(await listTradeBinder(testPrisma(), outro.user)).toHaveLength(1)
  })
})

describe('as duas contagens', () => {
  it('conta copias, e nao cartas', async () => {
    const dono = await owner()
    const troca = await createStorage(dono.userId, 'BINDER', 'TRADE')

    for (const quantidade of [3, 2]) {
      const { variant } = await createCardWithVariant()
      const item = await own(dono.collectionId, variant.id, quantidade)
      await allocate(item.id, troca.id, quantidade)
    }

    const binder = await listTradeBinder(testPrisma(), dono.user)

    expect(binder).toHaveLength(2)
    expect(countCopies(binder)).toBe(5)
  })

  it('conta zero num binder vazio', () => {
    expect(countCopies([])).toBe(0)
  })
})
