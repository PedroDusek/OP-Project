import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  getWantQuantity,
  getWantSummary,
  listWants,
} from '@/server/application/wants/read-wants'
import { setWantQuantity } from '@/server/application/wants/set-want'
import { ConflictError, NotFoundError } from '@/server/domain/errors'
import type { AuthenticatedUser } from '@/server/application/auth'
import {
  createCardWithVariant,
  createUser,
  createVariant,
  disconnect,
  own,
  resetDatabase,
  testPrisma,
} from '../helpers'

/**
 * A want list contra o banco de verdade.
 *
 * A aritmetica esta em `tests/domain/wants.test.ts`, sem banco. Aqui se
 * verifica o escopo por dono, a unicidade por (usuario, variante) e o cruzamento
 * com o que a pessoa ja possui — que e o que faz a lista dizer o que falta.
 */

type Owner = { user: AuthenticatedUser; collectionId: bigint }

async function owner(name = 'Dono'): Promise<Owner> {
  const created = await createUser(name)
  return {
    user: {
      id: created.id,
      email: `${name.toLowerCase()}@example.test`,
      name,
      plan: 'FREE',
      premiumUntil: null,
    },
    collectionId: created.collection!.id,
  }
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('definir o want', () => {
  it('cria a linha quando ainda nao existe', async () => {
    const { user } = await owner()
    const { variant } = await createCardWithVariant()

    const resultado = await setWantQuantity(testPrisma(), user, variant.id, 4)

    expect(resultado).toEqual({ quantity: 4, removed: false })
    expect(await getWantQuantity(testPrisma(), user, variant.id)).toBe(4)
  })

  /** Unicidade por (usuario, variante): gravar de novo atualiza, nao duplica. */
  it('atualiza a mesma linha em vez de criar outra', async () => {
    const { user } = await owner()
    const { variant } = await createCardWithVariant()

    await setWantQuantity(testPrisma(), user, variant.id, 2)
    await setWantQuantity(testPrisma(), user, variant.id, 3)

    expect(await getWantQuantity(testPrisma(), user, variant.id)).toBe(3)
    expect(await testPrisma().wantItem.count()).toBe(1)
  })

  /** Querer zero e nao ter a linha: o banco exige `quantity > 0`. */
  it('zerar tira da lista', async () => {
    const { user } = await owner()
    const { variant } = await createCardWithVariant()
    await setWantQuantity(testPrisma(), user, variant.id, 2)

    const resultado = await setWantQuantity(testPrisma(), user, variant.id, 0)

    expect(resultado).toEqual({ quantity: 0, removed: true })
    expect(await testPrisma().wantItem.count()).toBe(0)
  })

  it('zerar o que nao esta na lista nao e erro', async () => {
    const { user } = await owner()
    const { variant } = await createCardWithVariant()

    await expect(setWantQuantity(testPrisma(), user, variant.id, 0)).resolves.toEqual({
      quantity: 0,
      removed: true,
    })
  })

  it('recusa quantidade negativa', async () => {
    const { user } = await owner()
    const { variant } = await createCardWithVariant()

    await expect(setWantQuantity(testPrisma(), user, variant.id, -1)).rejects.toBeInstanceOf(
      ConflictError,
    )
  })

  it('recusa variante que nao existe', async () => {
    const { user } = await owner()

    await expect(setWantQuantity(testPrisma(), user, 999999n, 1)).rejects.toBeInstanceOf(
      NotFoundError,
    )
  })

  /** Wants sao por variante: normal e paralela sao dois wants independentes. */
  it('separa as artes da mesma carta', async () => {
    const { user } = await owner()
    const { card, variant } = await createCardWithVariant()
    const paralela = await createVariant(card.id, 'Parallel')

    await setWantQuantity(testPrisma(), user, variant.id, 1)
    await setWantQuantity(testPrisma(), user, paralela.id, 4)

    expect(await getWantQuantity(testPrisma(), user, variant.id)).toBe(1)
    expect(await getWantQuantity(testPrisma(), user, paralela.id)).toBe(4)
  })
})

describe('ler a want list', () => {
  it('cruza com o que a pessoa ja tem', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant('Character', 'OP01-001')
    await own(collectionId, variant.id, 2)
    await setWantQuantity(testPrisma(), user, variant.id, 4)

    const [want] = await listWants(testPrisma(), user)

    expect(want).toMatchObject({ wanted: 4, owned: 2, remaining: 2, status: 'partial' })
  })

  it('marca como conseguido quem ja tem o bastante', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant()
    await own(collectionId, variant.id, 4)
    await setWantQuantity(testPrisma(), user, variant.id, 4)

    const [want] = await listWants(testPrisma(), user)

    expect(want.status).toBe('satisfied')
    expect(want.remaining).toBe(0)
  })

  /** O recorte esconde o que ja foi conseguido, sem tirar da lista. */
  it('o recorte de faltantes esconde os conseguidos', async () => {
    const { user, collectionId } = await owner()
    const conseguida = await createCardWithVariant('Character', 'OP01-001')
    const faltando = await createCardWithVariant('Character', 'OP01-002')
    await own(collectionId, conseguida.variant.id, 1)
    await setWantQuantity(testPrisma(), user, conseguida.variant.id, 1)
    await setWantQuantity(testPrisma(), user, faltando.variant.id, 1)

    const todas = await listWants(testPrisma(), user)
    const faltantes = await listWants(testPrisma(), user, { scope: 'missing' })

    expect(todas).toHaveLength(2)
    expect(faltantes.map((w) => w.cardCode)).toEqual(['OP01-002'])
  })

  it('nao ve a lista de outra pessoa', async () => {
    const dono = await owner('Dono')
    const outro = await owner('Outro')
    const { variant } = await createCardWithVariant()
    await setWantQuantity(testPrisma(), dono.user, variant.id, 3)

    expect(await listWants(testPrisma(), outro.user)).toEqual([])
    expect(await getWantQuantity(testPrisma(), outro.user, variant.id)).toBe(0)
  })

  /** A mesma variante pode ser desejada por duas pessoas, sem uma ver a outra. */
  it('duas pessoas querem a mesma carta sem colidir', async () => {
    const primeira = await owner('Primeira')
    const segunda = await owner('Segunda')
    const { variant } = await createCardWithVariant()

    await setWantQuantity(testPrisma(), primeira.user, variant.id, 2)
    await setWantQuantity(testPrisma(), segunda.user, variant.id, 4)

    expect(await getWantQuantity(testPrisma(), primeira.user, variant.id)).toBe(2)
    expect(await getWantQuantity(testPrisma(), segunda.user, variant.id)).toBe(4)
  })

  it('filtra a lista como o catalogo filtra', async () => {
    const { user } = await owner()
    const lider = await createCardWithVariant('Leader', 'OP01-001')
    const personagem = await createCardWithVariant('Character', 'OP01-002')
    await setWantQuantity(testPrisma(), user, lider.variant.id, 1)
    await setWantQuantity(testPrisma(), user, personagem.variant.id, 1)

    const so = await listWants(testPrisma(), user, { type: 'Leader' })

    expect(so.map((w) => w.cardCode)).toEqual(['OP01-001'])
  })
})

describe('o resumo', () => {
  it('conta variantes, copias faltando e conseguidos', async () => {
    const { user, collectionId } = await owner()
    const conseguida = await createCardWithVariant()
    const faltando = await createCardWithVariant()
    await own(collectionId, conseguida.variant.id, 2)
    await setWantQuantity(testPrisma(), user, conseguida.variant.id, 2)
    await setWantQuantity(testPrisma(), user, faltando.variant.id, 3)

    expect(await getWantSummary(testPrisma(), user)).toEqual({
      variants: 2,
      remaining: 3,
      satisfied: 1,
    })
  })

  it('lista vazia soma zero', async () => {
    const { user } = await owner()

    expect(await getWantSummary(testPrisma(), user)).toEqual({
      variants: 0,
      remaining: 0,
      satisfied: 0,
    })
  })
})
