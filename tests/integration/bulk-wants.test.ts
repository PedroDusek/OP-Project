import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { bulkAddWants, MAX_BULK_WANTS } from '@/server/application/wants/bulk-wants'
import { getWantQuantity } from '@/server/application/wants/read-wants'
import type { AuthenticatedUser } from '@/server/application/auth'
import { createCardWithVariant, createUser, disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * A leva na want list.
 *
 * O que se protege e que ela **acrescenta**, e nao substitui: quem ja quer duas
 * e marca mais uma passa a querer tres. Substituir apagaria em silencio o que a
 * pessoa anotou carta a carta, que e o modo de falha caro aqui.
 */

async function owner(name = 'Dono'): Promise<AuthenticatedUser> {
  const created = await createUser(name)
  return {
    id: created.id,
    email: `${name.toLowerCase()}@example.test`,
    name,
    plan: 'FREE',
    premiumUntil: null,
  }
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('acrescentar em leva', () => {
  it('cria os wants que ainda nao existiam', async () => {
    const user = await owner()
    const a = await createCardWithVariant()
    const b = await createCardWithVariant()

    const resultado = await bulkAddWants(testPrisma(), user, [
      { cardVariantId: a.variant.id, copies: 2 },
      { cardVariantId: b.variant.id, copies: 1 },
    ])

    expect(resultado).toEqual({ variants: 2, copies: 3 })
    expect(await getWantQuantity(testPrisma(), user, a.variant.id)).toBe(2)
    expect(await getWantQuantity(testPrisma(), user, b.variant.id)).toBe(1)
  })

  /** O gesto e "achei mais uma que eu quero", nao "esqueca o que eu disse". */
  it('soma ao que a pessoa ja queria', async () => {
    const user = await owner()
    const { variant } = await createCardWithVariant()

    await bulkAddWants(testPrisma(), user, [{ cardVariantId: variant.id, copies: 2 }])
    await bulkAddWants(testPrisma(), user, [{ cardVariantId: variant.id, copies: 1 }])

    expect(await getWantQuantity(testPrisma(), user, variant.id)).toBe(3)
  })

  /** A mesma carta pode chegar duas vezes se a pessoa filtrar e voltar. */
  it('junta repeticoes dentro da mesma leva', async () => {
    const user = await owner()
    const { variant } = await createCardWithVariant()

    const resultado = await bulkAddWants(testPrisma(), user, [
      { cardVariantId: variant.id, copies: 1 },
      { cardVariantId: variant.id, copies: 2 },
    ])

    expect(resultado).toEqual({ variants: 1, copies: 3 })
    expect(await getWantQuantity(testPrisma(), user, variant.id)).toBe(3)
  })

  it('ignora quem nao acrescenta nada', async () => {
    const user = await owner()
    const a = await createCardWithVariant()
    const b = await createCardWithVariant()

    const resultado = await bulkAddWants(testPrisma(), user, [
      { cardVariantId: a.variant.id, copies: 2 },
      { cardVariantId: b.variant.id, copies: 0 },
    ])

    expect(resultado.variants).toBe(1)
    expect(await getWantQuantity(testPrisma(), user, b.variant.id)).toBe(0)
  })

  it('nao mexe na colecao', async () => {
    const user = await owner()
    const { variant } = await createCardWithVariant()

    await bulkAddWants(testPrisma(), user, [{ cardVariantId: variant.id, copies: 3 }])

    expect(await testPrisma().collectionItem.count()).toBe(0)
  })

  /** Cada want e de quem o pediu. */
  it('escreve so na lista de quem chamou', async () => {
    const dono = await owner('Dono')
    const outro = await owner('Outro')
    const { variant } = await createCardWithVariant()

    await bulkAddWants(testPrisma(), dono, [{ cardVariantId: variant.id, copies: 2 }])

    expect(await getWantQuantity(testPrisma(), outro, variant.id)).toBe(0)
  })
})

describe('o que a leva recusa', () => {
  it('recusa leva vazia', async () => {
    const user = await owner()

    await expect(bulkAddWants(testPrisma(), user, [])).rejects.toThrow(/ao menos uma carta/i)
  })

  it('recusa leva so de zeros', async () => {
    const user = await owner()
    const { variant } = await createCardWithVariant()

    await expect(
      bulkAddWants(testPrisma(), user, [{ cardVariantId: variant.id, copies: 0 }]),
    ).rejects.toThrow(/ao menos uma carta/i)
  })

  /** Acima do teto a transacao fica longa demais para uma tela esperar. */
  it('recusa leva acima do teto', async () => {
    const user = await owner()
    const entries = Array.from({ length: MAX_BULK_WANTS + 1 }, (_, i) => ({
      cardVariantId: BigInt(i + 1),
      copies: 1,
    }))

    await expect(bulkAddWants(testPrisma(), user, entries)).rejects.toThrow(/comporta até/i)
  })

  /**
   * Falha inteira, e nao pela metade: uma leva que grava metade deixaria a
   * pessoa sem saber o que entrou.
   */
  it('recusa a leva inteira quando uma carta nao existe', async () => {
    const user = await owner()
    const { variant } = await createCardWithVariant()

    await expect(
      bulkAddWants(testPrisma(), user, [
        { cardVariantId: variant.id, copies: 1 },
        { cardVariantId: 999_999_999n, copies: 1 },
      ]),
    ).rejects.toThrow(/não existe mais/i)

    expect(await getWantQuantity(testPrisma(), user, variant.id)).toBe(0)
  })
})
