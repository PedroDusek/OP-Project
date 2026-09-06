import type { PrismaClient } from '@prisma/client'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createPrisma } from '@/server/infrastructure/prisma'
import {
  createCardWithVariant,
  createStorage,
  createUser,
  disconnect,
  own,
  resetDatabase,
  testPrisma,
} from '../helpers'

/**
 * Concorrencia e testada, nao presumida.
 *
 * Cada transacao precisa de uma conexao propria, por isso os clientes extras.
 * Reaproveitar um unico cliente serializaria tudo no pool e o teste passaria
 * sem provar nada.
 */

const url = process.env.TEST_DATABASE_URL as string
const clients: PrismaClient[] = []

function client(): PrismaClient {
  const c = createPrisma(url)
  clients.push(c)
  return c
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await Promise.all(clients.map((c) => c.$disconnect()))
  clients.length = 0
  await disconnect()
})

describe('alocacoes concorrentes no mesmo item', () => {
  it('duas transacoes tentando alocar 3 de 4 deixam exatamente uma sobreviver', async () => {
    const user = await createUser()
    const { variant } = await createCardWithVariant()
    const item = await own(user.collection!.id, variant.id, 4)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')
    const box = await createStorage(user.id, 'BOX', 'COLLECTION')

    const a = client()
    const b = client()

    const first = a.$transaction(
      async (tx) => {
        await tx.collectionItemLocation.create({
          data: { collectionItemId: item.id, storageLocationId: binder.id, quantity: 3 },
        })
        // Segura o lock da linha pai enquanto a outra transacao tenta entrar.
        await sleep(600)
        return 'a'
      },
      { timeout: 20_000 },
    )

    const second = (async () => {
      await sleep(150)
      return b.$transaction(
        async (tx) => {
          await tx.collectionItemLocation.create({
            data: { collectionItemId: item.id, storageLocationId: box.id, quantity: 3 },
          })
          return 'b'
        },
        { timeout: 20_000 },
      )
    })()

    const results = await Promise.allSettled([first, second])
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)

    const total = await testPrisma().collectionItemLocation.aggregate({
      where: { collectionItemId: item.id },
      _sum: { quantity: true },
    })
    expect(total._sum.quantity).toBe(3)
  })

  it('duas transacoes que cabem juntas ambas sobrevivem', async () => {
    // O lock nao pode rejeitar escritas legitimas: 2 + 2 cabe em 4.
    const user = await createUser()
    const { variant } = await createCardWithVariant()
    const item = await own(user.collection!.id, variant.id, 4)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')
    const box = await createStorage(user.id, 'BOX', 'COLLECTION')

    const a = client()
    const b = client()

    const results = await Promise.allSettled([
      a.$transaction(
        async (tx) => {
          await tx.collectionItemLocation.create({
            data: { collectionItemId: item.id, storageLocationId: binder.id, quantity: 2 },
          })
          await sleep(400)
        },
        { timeout: 20_000 },
      ),
      (async () => {
        await sleep(100)
        return b.$transaction(
          async (tx) => {
            await tx.collectionItemLocation.create({
              data: { collectionItemId: item.id, storageLocationId: box.id, quantity: 2 },
            })
          },
          { timeout: 20_000 },
        )
      })(),
    ])

    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0)

    const total = await testPrisma().collectionItemLocation.aggregate({
      where: { collectionItemId: item.id },
      _sum: { quantity: true },
    })
    expect(total._sum.quantity).toBe(4)
  })

  it('reduzir a quantidade em paralelo com uma alocacao nao rompe a invariante', async () => {
    const user = await createUser()
    const { variant } = await createCardWithVariant()
    const item = await own(user.collection!.id, variant.id, 4)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')
    const box = await createStorage(user.id, 'BOX', 'COLLECTION')
    await testPrisma().collectionItemLocation.create({
      data: { collectionItemId: item.id, storageLocationId: binder.id, quantity: 2 },
    })

    const a = client()
    const b = client()

    await Promise.allSettled([
      a.$transaction(
        async (tx) => {
          await tx.collectionItemLocation.create({
            data: { collectionItemId: item.id, storageLocationId: box.id, quantity: 2 },
          })
          await sleep(400)
        },
        { timeout: 20_000 },
      ),
      (async () => {
        await sleep(100)
        return b.$transaction(
          async (tx) => {
            await tx.collectionItem.update({
              where: { id: item.id },
              data: { quantity: 2 },
            })
          },
          { timeout: 20_000 },
        )
      })(),
    ])

    // Qualquer que seja o vencedor, o estado final respeita a invariante.
    const finalItem = await testPrisma().collectionItem.findUniqueOrThrow({
      where: { id: item.id },
    })
    const allocated = await testPrisma().collectionItemLocation.aggregate({
      where: { collectionItemId: item.id },
      _sum: { quantity: true },
    })
    expect(allocated._sum.quantity ?? 0).toBeLessThanOrEqual(finalItem.quantity)
  })
})
