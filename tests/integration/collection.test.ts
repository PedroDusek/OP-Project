import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  getCollectionSummary,
  listPlaysets,
  searchCollection,
} from '@/server/application/collection/read-collection'
import {
  QUANTITY_BELOW_ALLOCATED,
  setCollectionQuantity,
} from '@/server/application/collection/set-quantity'
import { ConflictError, NotFoundError } from '@/server/domain/errors'
import type { AuthenticatedUser } from '@/server/application/auth'
import {
  allocate,
  createCardWithVariant,
  createStorage,
  createUser,
  createVariant,
  disconnect,
  resetDatabase,
  testPrisma,
} from '../helpers'

/**
 * A colecao contra o banco de verdade: transacao, lock e o conflito da
 * decisao 007.
 *
 * A aritmetica de contagem esta em `tests/domain/collection-counting.test.ts`,
 * sem banco. Aqui se verifica o que so o banco garante.
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

describe('definir quantidade', () => {
  it('cria o item quando ele ainda nao existe', async () => {
    const { user } = await owner()
    const { variant } = await createCardWithVariant()

    const result = await setCollectionQuantity(testPrisma(), user, variant.id, 3)

    expect(result).toEqual({ quantity: 3, removed: false })
    const summary = await getCollectionSummary(testPrisma(), user)
    expect(summary.totalCards).toBe(3)
  })

  it('atualiza o item existente', async () => {
    const { user } = await owner()
    const { variant } = await createCardWithVariant()

    await setCollectionQuantity(testPrisma(), user, variant.id, 3)
    await setCollectionQuantity(testPrisma(), user, variant.id, 7)

    expect((await getCollectionSummary(testPrisma(), user)).totalCards).toBe(7)
  })

  /** O banco exige `quantity > 0`: possuir zero e nao ter a linha. */
  it('zerar remove a variante da colecao', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant()

    await setCollectionQuantity(testPrisma(), user, variant.id, 2)
    const result = await setCollectionQuantity(testPrisma(), user, variant.id, 0)

    expect(result).toEqual({ quantity: 0, removed: true })
    expect(
      await testPrisma().collectionItem.count({ where: { collectionId } }),
    ).toBe(0)
  })

  it('zerar o que nao existe nao e erro', async () => {
    const { user } = await owner()
    const { variant } = await createCardWithVariant()

    await expect(setCollectionQuantity(testPrisma(), user, variant.id, 0)).resolves.toEqual({
      quantity: 0,
      removed: true,
    })
  })

  it('recusa quantidade negativa', async () => {
    const { user } = await owner()
    const { variant } = await createCardWithVariant()

    await expect(setCollectionQuantity(testPrisma(), user, variant.id, -1)).rejects.toBeInstanceOf(
      ConflictError,
    )
  })

  it('recusa variante que nao existe', async () => {
    const { user } = await owner()

    await expect(setCollectionQuantity(testPrisma(), user, 999_999n, 1)).rejects.toBeInstanceOf(
      NotFoundError,
    )
  })

  /**
   * A propriedade e garantida escopando pela colecao do usuario da sessao. Duas
   * pessoas mexendo na mesma variante mexem em colecoes diferentes.
   */
  it('cada pessoa mexe apenas na propria colecao', async () => {
    const a = await owner('Ana')
    const b = await owner('Bruno')
    const { variant } = await createCardWithVariant()

    await setCollectionQuantity(testPrisma(), a.user, variant.id, 4)
    await setCollectionQuantity(testPrisma(), b.user, variant.id, 1)

    expect((await getCollectionSummary(testPrisma(), a.user)).totalCards).toBe(4)
    expect((await getCollectionSummary(testPrisma(), b.user)).totalCards).toBe(1)
  })
})

describe('reduzir abaixo do que esta alocado (decisao 007)', () => {
  async function comAlocacoes() {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant()
    await setCollectionQuantity(testPrisma(), user, variant.id, 4)

    const item = await testPrisma().collectionItem.findFirstOrThrow({
      where: { collectionId, cardVariantId: variant.id },
      select: { id: true },
    })
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')
    const box = await createStorage(user.id, 'BOX', 'COLLECTION')
    await allocate(item.id, binder.id, 3)
    await allocate(item.id, box.id, 1)

    return { user, variant, binder, box }
  }

  /**
   * O exemplo da decisao 007: possui 4 (binder 3, box 1) e reduz para 2. A
   * escrita e recusada inteira, e o conflito carrega as alocacoes.
   */
  it('recusa a escrita e devolve as alocacoes atuais', async () => {
    const { user, variant, binder, box } = await comAlocacoes()

    const error = await setCollectionQuantity(testPrisma(), user, variant.id, 2).catch((e) => e)

    expect(error).toBeInstanceOf(ConflictError)
    expect((error as ConflictError).code).toBe(QUANTITY_BELOW_ALLOCATED)

    const details = (error as ConflictError).details as {
      requestedQuantity: number
      currentQuantity: number
      totalAllocated: number
      allocations: { storageLocationId: string; storageName: string; quantity: number }[]
    }
    expect(details.requestedQuantity).toBe(2)
    expect(details.currentQuantity).toBe(4)
    expect(details.totalAllocated).toBe(4)
    expect(details.allocations).toHaveLength(2)
    expect(details.allocations.map((a) => a.storageLocationId).sort()).toEqual(
      [String(binder.id), String(box.id)].sort(),
    )
  })

  /** Recusada **inteira**: a quantidade no banco nao muda. */
  it('nao deixa estado pela metade', async () => {
    const { user, variant } = await comAlocacoes()

    await setCollectionQuantity(testPrisma(), user, variant.id, 2).catch(() => {})

    expect((await getCollectionSummary(testPrisma(), user)).totalCards).toBe(4)
  })

  it('nenhuma alocacao e removida em silencio', async () => {
    const { user, variant } = await comAlocacoes()

    await setCollectionQuantity(testPrisma(), user, variant.id, 0).catch(() => {})

    const restantes = await testPrisma().collectionItemLocation.count()
    expect(restantes).toBe(2)
  })

  it('reduzir ate o que esta alocado e permitido', async () => {
    const { user, variant } = await comAlocacoes()

    await expect(setCollectionQuantity(testPrisma(), user, variant.id, 4)).resolves.toMatchObject({
      quantity: 4,
    })
  })

  it('aumentar continua livre', async () => {
    const { user, variant } = await comAlocacoes()

    await expect(setCollectionQuantity(testPrisma(), user, variant.id, 9)).resolves.toMatchObject({
      quantity: 9,
    })
  })
})

describe('concorrencia', () => {
  /**
   * Duas escritas simultaneas na mesma variante. Sem o lock de linha, as duas
   * leriam o mesmo estado e a segunda apagaria a primeira; com ele, uma espera
   * pela outra e o resultado e uma das duas, nunca um valor inventado.
   */
  it('duas edicoes simultaneas nao se perdem', async () => {
    const { user } = await owner()
    const { variant } = await createCardWithVariant()

    const resultados = await Promise.allSettled([
      setCollectionQuantity(testPrisma(), user, variant.id, 5),
      setCollectionQuantity(testPrisma(), user, variant.id, 8),
    ])

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(2)

    const final = (await getCollectionSummary(testPrisma(), user)).totalCards
    expect([5, 8]).toContain(final)
  })

  /** A insercao concorrente da mesma variante nao pode virar erro de unicidade. */
  it('duas criacoes simultaneas produzem um item so', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant()

    await Promise.allSettled([
      setCollectionQuantity(testPrisma(), user, variant.id, 2),
      setCollectionQuantity(testPrisma(), user, variant.id, 3),
    ])

    expect(await testPrisma().collectionItem.count({ where: { collectionId } })).toBe(1)
  })
})

describe('resumo e listagem', () => {
  it('colecao vazia devolve zeros e o tamanho do catalogo', async () => {
    const { user } = await owner()
    await createCardWithVariant()

    const summary = await getCollectionSummary(testPrisma(), user)

    expect(summary.totalCards).toBe(0)
    expect(summary.uniqueVariants).toBe(0)
    expect(summary.closedPlaysets).toBe(0)
    expect(summary.catalogVariants).toBeGreaterThan(0)
  })

  it('conta playset somando variantes da mesma carta', async () => {
    const { user } = await owner()
    const { card, variant } = await createCardWithVariant()
    const outraArte = await createVariant(card.id, 'Parallel')

    await setCollectionQuantity(testPrisma(), user, variant.id, 2)
    await setCollectionQuantity(testPrisma(), user, outraArte.id, 2)

    const summary = await getCollectionSummary(testPrisma(), user)
    expect(summary.totalCards).toBe(4)
    expect(summary.uniqueVariants).toBe(2)
    expect(summary.closedPlaysets).toBe(1)
  })

  it('a listagem traz so o que a pessoa possui', async () => {
    const { user } = await owner()
    const possuida = await createCardWithVariant('Character', 'OP01-001')
    await createCardWithVariant('Character', 'OP01-002')

    await setCollectionQuantity(testPrisma(), user, possuida.variant.id, 1)

    const page = await searchCollection(testPrisma(), user, {})
    expect(page.total).toBe(1)
    expect(page.items[0].cardCode).toBe('OP01-001')
    expect(page.items[0].quantity).toBe(1)
  })

  /**
   * O playset e por carta, e o filtro pode esconder variantes dela. Filtrar por
   * uma arte nao pode fazer um playset fechado parecer aberto.
   */
  it('o playset considera a colecao inteira, nao o recorte do filtro', async () => {
    const { user } = await owner()
    const { card, variant } = await createCardWithVariant()
    const outraArte = await createVariant(card.id, 'Parallel')

    await setCollectionQuantity(testPrisma(), user, variant.id, 2)
    await setCollectionQuantity(testPrisma(), user, outraArte.id, 2)

    const soParallel = await searchCollection(testPrisma(), user, { variantType: 'Parallel' })

    expect(soParallel.total).toBe(1)
    expect(soParallel.items[0].quantity).toBe(2)
    expect(soParallel.items[0].quantityForCard).toBe(4)
    expect(soParallel.items[0].playsetClosed).toBe(true)
  })

  it('o recorte de playsets traz so as cartas fechadas', async () => {
    const { user } = await owner()
    const fechada = await createCardWithVariant('Character', 'OP01-001')
    const aberta = await createCardWithVariant('Character', 'OP01-002')

    await setCollectionQuantity(testPrisma(), user, fechada.variant.id, 4)
    await setCollectionQuantity(testPrisma(), user, aberta.variant.id, 1)

    const playsets = await searchCollection(testPrisma(), user, { scope: 'playsets' })
    const faltando = await searchCollection(testPrisma(), user, { scope: 'incomplete' })

    expect(playsets.items.map((i) => i.cardCode)).toEqual(['OP01-001'])
    expect(faltando.items.map((i) => i.cardCode)).toEqual(['OP01-002'])
  })

  it('listPlaysets agrupa por carta e exclui Leader', async () => {
    const { user } = await owner()
    const personagem = await createCardWithVariant('Character', 'OP01-001')
    const lider = await createCardWithVariant('Leader', 'OP01-002')

    await setCollectionQuantity(testPrisma(), user, personagem.variant.id, 4)
    await setCollectionQuantity(testPrisma(), user, lider.variant.id, 10)

    const rows = await listPlaysets(testPrisma(), user)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ cardCode: 'OP01-001', quantity: 4, closed: true })
  })
})
