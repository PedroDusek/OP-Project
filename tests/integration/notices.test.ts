import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { AuthenticatedUser } from '@/server/application/auth'
import { readNotices } from '@/server/application/notifications/notices'
import { allocate, createCardWithVariant, createStorage, createUser, disconnect, own, resetDatabase, testPrisma } from '../helpers'

/** Os avisos pendentes de quem está na sessão (decisão 080). */

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('os avisos do sino', () => {
  it('avisa das cópias sem lugar, e para de avisar quando elas são guardadas', async () => {
    const criada = await createUser('Ana')
    const ana: AuthenticatedUser = { id: criada.id, email: criada.email, name: 'Ana', plan: 'FREE', premiumUntil: null }
    const { variant } = await createCardWithVariant()
    const item = await own(criada.collection!.id, variant.id, 3)

    // Sem local nenhum, nao avisa.
    expect(await readNotices(testPrisma(), ana)).toEqual([])

    const binder = await createStorage(criada.id, 'BINDER', 'COLLECTION')
    expect(await readNotices(testPrisma(), ana)).toEqual([{ kind: 'unallocated-cards', copies: 3, cards: 1 }])

    await allocate(item.id, binder.id, 3)
    expect(await readNotices(testPrisma(), ana)).toEqual([])
  })
})
