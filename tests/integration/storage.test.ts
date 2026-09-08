import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  getStorageLocation,
  listCardsInLocation,
  listStorageLocations,
} from '@/server/application/storage/read-locations'
import {
  createStorageLocation,
  deleteStorageLocation,
  updateStorageLocation,
} from '@/server/application/storage/write-locations'
import {
  ALLOCATION_EXCEEDS_OWNED,
  addAllocation,
  listVariantAllocations,
  setAllocation,
} from '@/server/application/storage/allocate'
import {
  countUnallocated,
  listUnallocated,
} from '@/server/application/storage/unallocated'
import {
  QUANTITY_BELOW_ALLOCATED,
  RESOLUTION_INVALID,
  setCollectionQuantity,
} from '@/server/application/collection/set-quantity'
import { ConflictError, NotFoundError, ValidationError } from '@/server/domain/errors'
import type { ImageStorage, UploadImageInput } from '@/server/http/image-storage'
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
 * O armazenamento contra o banco de verdade.
 *
 * A aritmetica esta em `tests/domain/storage.test.ts`, sem banco. Aqui se
 * verifica o que so o banco garante: a invariante entre linhas, o lock, o
 * cascade e o escopo por dono.
 */

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])

/** Provedor de imagens em memoria: nenhum teste toca a rede. */
class FakeImageStorage implements ImageStorage {
  readonly name = 'fake'
  available = true
  readonly uploaded: string[] = []
  readonly removed: string[] = []
  failNext = false

  async upload({ scope, extension }: UploadImageInput) {
    if (this.failNext) {
      this.failNext = false
      throw new Error('falha simulada')
    }
    const url = `https://exemplo.test/${scope}/${this.uploaded.length}.${extension}`
    this.uploaded.push(url)
    return { url }
  }

  async remove(url: string) {
    this.removed.push(url)
  }
}

let images: FakeImageStorage

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

const input = (overrides: Partial<Parameters<typeof createStorageLocation>[3]> = {}) => ({
  name: 'Binder Principal',
  description: null,
  type: 'BINDER',
  purpose: 'COLLECTION',
  ...overrides,
})

beforeEach(async () => {
  await resetDatabase()
  images = new FakeImageStorage()
})

afterAll(async () => {
  await disconnect()
})

describe('criar local', () => {
  it('grava tipo, finalidade e descricao', async () => {
    const { user } = await owner()

    const { id } = await createStorageLocation(testPrisma(), images, user, {
      ...input(),
      description: 'Cartas em perfeitas condições.',
    })

    const detail = await getStorageLocation(testPrisma(), user, BigInt(id))
    expect(detail).toMatchObject({
      name: 'Binder Principal',
      type: 'BINDER',
      purpose: 'COLLECTION',
      subtitle: 'Binder • Coleção',
      description: 'Cartas em perfeitas condições.',
    })
  })

  /** O CHECK do banco recusaria; a validacao chega antes com o campo certo. */
  it('recusa binder sem finalidade, apontando o campo', async () => {
    const { user } = await owner()

    const erro = await createStorageLocation(testPrisma(), images, user, {
      ...input(),
      purpose: null,
    }).catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(ValidationError)
    expect((erro as ValidationError).fields).toHaveProperty('purpose')
  })

  it('descarta a finalidade que sobrou num deck', async () => {
    const { user } = await owner()

    const { id } = await createStorageLocation(testPrisma(), images, user, {
      ...input(),
      type: 'DECK',
      purpose: 'COLLECTION',
      name: 'Deck Sabo',
    })

    const detail = await getStorageLocation(testPrisma(), user, BigInt(id))
    expect(detail).toMatchObject({ type: 'DECK', purpose: null, subtitle: 'Deck' })
  })

  it('recusa nome vazio', async () => {
    const { user } = await owner()

    await expect(
      createStorageLocation(testPrisma(), images, user, { ...input(), name: '   ' }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('recusa arquivo que nao e imagem', async () => {
    const { user } = await owner()
    const html = new TextEncoder().encode('<html></html>')

    await expect(
      createStorageLocation(testPrisma(), images, user, { ...input(), image: html }),
    ).rejects.toBeInstanceOf(ValidationError)
    expect(images.uploaded).toHaveLength(0)
  })

  it('guarda a URL da imagem enviada, sob o escopo do dono', async () => {
    const { user } = await owner()

    const { id } = await createStorageLocation(testPrisma(), images, user, {
      ...input(),
      image: PNG,
    })

    const detail = await getStorageLocation(testPrisma(), user, BigInt(id))
    expect(detail!.image).toBe(images.uploaded[0])
    expect(images.uploaded[0]).toContain(`/${user.id}/`)
  })

  /** Sem isto, uma criacao que falha deixa o arquivo pago e sem dono. */
  it('apaga a imagem se a escrita no banco falhar', async () => {
    const { user } = await owner()

    await expect(
      createStorageLocation(testPrisma(), images, user, {
        ...input(),
        name: 'x'.repeat(50),
        // Descricao acima do limite do banco: passa pela validacao de nome e
        // quebra no INSERT.
        description: 'y'.repeat(600),
        image: PNG,
      }),
    ).rejects.toBeTruthy()

    expect(images.removed).toEqual(images.uploaded)
  })
})

describe('editar local', () => {
  it('troca a imagem e apaga a antiga', async () => {
    const { user } = await owner()
    const { id } = await createStorageLocation(testPrisma(), images, user, {
      ...input(),
      image: PNG,
    })
    const antiga = images.uploaded[0]

    await updateStorageLocation(testPrisma(), images, user, BigInt(id), {
      ...input(),
      image: PNG,
    })

    const detail = await getStorageLocation(testPrisma(), user, BigInt(id))
    expect(detail!.image).toBe(images.uploaded[1])
    expect(images.removed).toEqual([antiga])
  })

  it('sem arquivo novo, a foto atual fica onde está', async () => {
    const { user } = await owner()
    const { id } = await createStorageLocation(testPrisma(), images, user, {
      ...input(),
      image: PNG,
    })

    await updateStorageLocation(testPrisma(), images, user, BigInt(id), {
      ...input(),
      name: 'Outro nome',
    })

    const detail = await getStorageLocation(testPrisma(), user, BigInt(id))
    expect(detail!.image).toBe(images.uploaded[0])
    expect(detail!.name).toBe('Outro nome')
    expect(images.removed).toHaveLength(0)
  })

  it('tira a foto quando pedido', async () => {
    const { user } = await owner()
    const { id } = await createStorageLocation(testPrisma(), images, user, {
      ...input(),
      image: PNG,
    })

    await updateStorageLocation(testPrisma(), images, user, BigInt(id), {
      ...input(),
      removeImage: true,
    })

    const detail = await getStorageLocation(testPrisma(), user, BigInt(id))
    expect(detail!.image).toBeNull()
    expect(images.removed).toEqual([images.uploaded[0]])
  })

  /** Escopo por dono: o id de outra pessoa nao existe daqui. */
  it('nao edita local de outra pessoa', async () => {
    const dono = await owner('Dono')
    const outro = await owner('Outro')
    const local = await createStorage(dono.user.id, 'BINDER', 'COLLECTION')

    await expect(
      updateStorageLocation(testPrisma(), images, outro.user, local.id, input()),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('excluir local', () => {
  /**
   * As alocacoes vao junto por cascade; a colecao nao muda. As copias continuam
   * sendo da pessoa, agora sem lugar registrado — estado normal da secao 3.2.
   */
  it('leva as alocacoes e deixa a colecao intacta', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant()
    const item = await own(collectionId, variant.id, 4)
    const local = await createStorage(user.id, 'BINDER', 'COLLECTION')
    await allocate(item.id, local.id, 3)

    await deleteStorageLocation(testPrisma(), images, user, local.id)

    expect(await getStorageLocation(testPrisma(), user, local.id)).toBeNull()
    const restante = await testPrisma().collectionItem.findUnique({ where: { id: item.id } })
    expect(restante!.quantity).toBe(4)
    expect(await testPrisma().collectionItemLocation.count()).toBe(0)
  })

  it('nao exclui local de outra pessoa', async () => {
    const dono = await owner('Dono')
    const outro = await owner('Outro')
    const local = await createStorage(dono.user.id, 'BOX', 'TRADE')

    await expect(
      deleteStorageLocation(testPrisma(), images, outro.user, local.id),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('leitura', () => {
  it('conta as copias guardadas em cada local', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant()
    const item = await own(collectionId, variant.id, 5)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION', 'Binder')
    const caixa = await createStorage(user.id, 'BOX', 'TRADE', 'Caixa')
    await allocate(item.id, binder.id, 3)
    await allocate(item.id, caixa.id, 1)

    const locais = await listStorageLocations(testPrisma(), user)

    expect(locais.map((l) => [l.name, l.cardCount])).toEqual([
      ['Binder', 3],
      ['Caixa', 1],
    ])
  })

  it('so lista os locais do dono', async () => {
    const dono = await owner('Dono')
    const outro = await owner('Outro')
    await createStorage(dono.user.id, 'BINDER', 'COLLECTION')

    expect(await listStorageLocations(testPrisma(), outro.user)).toEqual([])
  })

  /**
   * Playset aqui e por local, e nao o da colecao: tres copias no binder e uma
   * na caixa fecham playset na colecao e nao fecham no binder.
   */
  it('conta playset completo dentro do local', async () => {
    const { user, collectionId } = await owner()
    const inteiro = await createCardWithVariant()
    const partido = await createCardWithVariant()
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')
    const caixa = await createStorage(user.id, 'BOX', 'COLLECTION')

    const itemInteiro = await own(collectionId, inteiro.variant.id, 4)
    await allocate(itemInteiro.id, binder.id, 4)

    const itemPartido = await own(collectionId, partido.variant.id, 4)
    await allocate(itemPartido.id, binder.id, 3)
    await allocate(itemPartido.id, caixa.id, 1)

    const detail = await getStorageLocation(testPrisma(), user, binder.id)
    expect(detail).toMatchObject({ cardCount: 7, uniqueVariants: 2, closedPlaysetsHere: 1 })
  })

  /** Cenario obrigatorio 3 da secao 7: Leader nunca fecha playset. */
  it('leader nao fecha playset nem dentro do local', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant('Leader')
    const deck = await createStorage(user.id, 'DECK', null)
    const item = await own(collectionId, variant.id, 10)
    await allocate(item.id, deck.id, 10)

    const detail = await getStorageLocation(testPrisma(), user, deck.id)
    expect(detail!.closedPlaysetsHere).toBe(0)
  })

  it('lista as cartas guardadas, com o que ha ali e o que se possui', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant('Character', 'OP01-001')
    const item = await own(collectionId, variant.id, 5)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')
    await allocate(item.id, binder.id, 2)

    const cartas = await listCardsInLocation(testPrisma(), user, binder.id)

    expect(cartas).toHaveLength(1)
    expect(cartas[0]).toMatchObject({ cardCode: 'OP01-001', quantity: 2, ownedQuantity: 5 })
  })

  it('nao mostra as cartas de local alheio', async () => {
    const dono = await owner('Dono')
    const outro = await owner('Outro')
    const { variant } = await createCardWithVariant()
    const item = await own(dono.collectionId, variant.id, 2)
    const binder = await createStorage(dono.user.id, 'BINDER', 'COLLECTION')
    await allocate(item.id, binder.id, 2)

    expect(await listCardsInLocation(testPrisma(), outro.user, binder.id)).toEqual([])
  })
})

describe('alocar', () => {
  it('guarda copias e devolve o que sobrou solto', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant()
    await own(collectionId, variant.id, 4)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')

    await setAllocation(testPrisma(), user, variant.id, binder.id, 3)

    const estado = await listVariantAllocations(testPrisma(), user, variant.id)
    expect(estado).toMatchObject({ ownedQuantity: 4, allocated: 3, unallocated: 1 })
  })

  /** Cenario obrigatorio 7: possui 4, binder 3 + caixa 2 e rejeitado. */
  it('recusa alocar alem do que se possui', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant()
    await own(collectionId, variant.id, 4)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION', 'Binder')
    const caixa = await createStorage(user.id, 'BOX', 'COLLECTION', 'Caixa')
    await setAllocation(testPrisma(), user, variant.id, binder.id, 3)

    const erro = await setAllocation(testPrisma(), user, variant.id, caixa.id, 2).catch(
      (e: unknown) => e,
    )

    expect(erro).toBeInstanceOf(ConflictError)
    expect((erro as ConflictError).code).toBe(ALLOCATION_EXCEEDS_OWNED)
    expect((erro as ConflictError).details).toMatchObject({ room: 1 })
  })

  it('editar o proprio local reaproveita o espaco que ele ja ocupa', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant()
    await own(collectionId, variant.id, 4)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')
    await setAllocation(testPrisma(), user, variant.id, binder.id, 3)

    await expect(
      setAllocation(testPrisma(), user, variant.id, binder.id, 4),
    ).resolves.toMatchObject({ quantity: 4 })
  })

  it('zerar tira a carta do local', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant()
    await own(collectionId, variant.id, 2)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')
    await setAllocation(testPrisma(), user, variant.id, binder.id, 2)

    await setAllocation(testPrisma(), user, variant.id, binder.id, 0)

    expect(await testPrisma().collectionItemLocation.count()).toBe(0)
  })

  /** Cenario obrigatorio 6: carta em deck continua contando na colecao. */
  it('carta guardada num deck continua na colecao', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant()
    await own(collectionId, variant.id, 3)
    const deck = await createStorage(user.id, 'DECK', null)

    await setAllocation(testPrisma(), user, variant.id, deck.id, 3)

    const item = await testPrisma().collectionItem.findFirst({ where: { collectionId } })
    expect(item!.quantity).toBe(3)
  })

  it('nao aloca em local de outra pessoa', async () => {
    const dono = await owner('Dono')
    const outro = await owner('Outro')
    const { variant } = await createCardWithVariant()
    await own(outro.collectionId, variant.id, 2)
    const local = await createStorage(dono.user.id, 'BINDER', 'COLLECTION')

    await expect(
      setAllocation(testPrisma(), outro.user, variant.id, local.id, 1),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('recusa guardar carta que nao esta na colecao', async () => {
    const { user } = await owner()
    const { variant } = await createCardWithVariant()
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')

    await expect(
      setAllocation(testPrisma(), user, variant.id, binder.id, 1),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  /**
   * Duas alocacoes simultaneas em locais diferentes leem a mesma soma. Sem o
   * lock na linha da colecao, as duas passariam — cada uma certa sozinha.
   */
  it('duas alocacoes ao mesmo tempo nao ultrapassam o possuido', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant()
    await own(collectionId, variant.id, 4)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION', 'Binder')
    const caixa = await createStorage(user.id, 'BOX', 'COLLECTION', 'Caixa')

    const resultados = await Promise.allSettled([
      setAllocation(testPrisma(), user, variant.id, binder.id, 3),
      setAllocation(testPrisma(), user, variant.id, caixa.id, 3),
    ])

    const aceitas = resultados.filter((r) => r.status === 'fulfilled')
    expect(aceitas).toHaveLength(1)

    const estado = await listVariantAllocations(testPrisma(), user, variant.id)
    expect(estado.allocated).toBeLessThanOrEqual(4)
  })

  it('lista todos os locais, inclusive os vazios, para escolher', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant()
    await own(collectionId, variant.id, 2)
    await createStorage(user.id, 'BINDER', 'COLLECTION', 'Binder')
    await createStorage(user.id, 'DECK', null, 'Deck Sabo')

    const estado = await listVariantAllocations(testPrisma(), user, variant.id)

    expect(estado.locations.map((l) => [l.name, l.quantity, l.subtitle])).toEqual([
      ['Binder', 0, 'Binder • Coleção'],
      ['Deck Sabo', 0, 'Deck'],
    ])
  })
})

describe('resolucao da decisao 007', () => {
  async function comConflito() {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant()
    const item = await own(collectionId, variant.id, 4)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION', 'Binder')
    const caixa = await createStorage(user.id, 'BOX', 'COLLECTION', 'Caixa')
    await allocate(item.id, binder.id, 3)
    await allocate(item.id, caixa.id, 1)
    return { user, variant, binder, caixa, item }
  }

  it('sem resolucao, a reducao volta com as alocacoes', async () => {
    const { user, variant } = await comConflito()

    const erro = await setCollectionQuantity(testPrisma(), user, variant.id, 2).catch(
      (e: unknown) => e,
    )

    expect((erro as ConflictError).code).toBe(QUANTITY_BELOW_ALLOCATED)
    expect((erro as ConflictError).details).toMatchObject({ totalAllocated: 4 })
  })

  /**
   * Reduzir e desalocar numa transacao so: entre as duas nao existe instante em
   * que a colecao esteja com alocacao orfa.
   */
  it('reduz e desaloca na mesma operacao', async () => {
    const { user, variant, binder, item } = await comConflito()

    const resultado = await setCollectionQuantity(testPrisma(), user, variant.id, 2, [
      { storageLocationId: String(binder.id), quantity: 2 },
    ])

    expect(resultado).toEqual({ quantity: 2, removed: false })
    const alocacoes = await testPrisma().collectionItemLocation.findMany({
      where: { collectionItemId: item.id },
      orderBy: { storageLocationId: 'asc' },
    })
    expect(alocacoes.map((a) => a.quantity)).toEqual([1, 1])
  })

  it('retirar tudo de um local apaga a linha', async () => {
    const { user, variant, binder, caixa } = await comConflito()

    await setCollectionQuantity(testPrisma(), user, variant.id, 1, [
      { storageLocationId: String(binder.id), quantity: 3 },
    ])

    const restantes = await testPrisma().collectionItemLocation.findMany()
    expect(restantes).toHaveLength(1)
    expect(restantes[0].storageLocationId).toBe(caixa.id)
  })

  it('recusa a resolucao que nao fecha a conta', async () => {
    const { user, variant, binder } = await comConflito()

    const erro = await setCollectionQuantity(testPrisma(), user, variant.id, 2, [
      { storageLocationId: String(binder.id), quantity: 1 },
    ]).catch((e: unknown) => e)

    expect((erro as ConflictError).code).toBe(RESOLUTION_INVALID)
    expect((erro as ConflictError).message).toContain('1')
  })

  /** Nada e gravado quando a resolucao e recusada. */
  it('resolucao recusada nao mexe em nada', async () => {
    const { user, variant, binder, item } = await comConflito()

    await setCollectionQuantity(testPrisma(), user, variant.id, 2, [
      { storageLocationId: String(binder.id), quantity: 1 },
    ]).catch(() => undefined)

    const [depois, alocado] = await Promise.all([
      testPrisma().collectionItem.findUnique({ where: { id: item.id } }),
      testPrisma().collectionItemLocation.aggregate({
        where: { collectionItemId: item.id },
        _sum: { quantity: true },
      }),
    ])
    expect(depois!.quantity).toBe(4)
    expect(alocado._sum.quantity).toBe(4)
  })

  it('zerar a carta com resolucao completa a tira da colecao', async () => {
    const { user, variant, binder, caixa } = await comConflito()

    const resultado = await setCollectionQuantity(testPrisma(), user, variant.id, 0, [
      { storageLocationId: String(binder.id), quantity: 3 },
      { storageLocationId: String(caixa.id), quantity: 1 },
    ])

    expect(resultado).toEqual({ quantity: 0, removed: true })
    expect(await testPrisma().collectionItem.count()).toBe(0)
    expect(await testPrisma().collectionItemLocation.count()).toBe(0)
  })
})

/**
 * Copias sem lugar registrado.
 *
 * Nao existe local "sem lugar" (`business-rules.md` 3.2): isto e o resto da
 * conta — possuido menos alocado —, calculado na leitura. Materializar seria
 * criar um segundo lugar capaz de divergir da soma real.
 */
describe('cartas sem lugar', () => {
  it('conta as copias soltas e as cartas que as tem', async () => {
    const { user, collectionId } = await owner()
    const solta = await createCardWithVariant()
    const guardada = await createCardWithVariant()
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')

    const itemSolto = await own(collectionId, solta.variant.id, 4)
    await allocate(itemSolto.id, binder.id, 1)

    const itemGuardado = await own(collectionId, guardada.variant.id, 2)
    await allocate(itemGuardado.id, binder.id, 2)

    // Tres soltas, todas da mesma carta.
    expect(await countUnallocated(testPrisma(), user)).toEqual({ copies: 3, cards: 1 })
  })

  it('carta sem nenhuma alocacao esta inteira sem lugar', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant()
    await own(collectionId, variant.id, 3)

    expect(await countUnallocated(testPrisma(), user)).toEqual({ copies: 3, cards: 1 })
  })

  it('colecao inteiramente guardada nao gera lembrete', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant()
    const item = await own(collectionId, variant.id, 2)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')
    await allocate(item.id, binder.id, 2)

    expect(await countUnallocated(testPrisma(), user)).toEqual({ copies: 0, cards: 0 })
  })

  it('lista so quem tem copia solta, com a conta de cada uma', async () => {
    const { user, collectionId } = await owner()
    const solta = await createCardWithVariant('Character', 'OP01-001')
    const guardada = await createCardWithVariant('Character', 'OP01-002')
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')

    const itemSolto = await own(collectionId, solta.variant.id, 4)
    await allocate(itemSolto.id, binder.id, 1)
    const itemGuardado = await own(collectionId, guardada.variant.id, 1)
    await allocate(itemGuardado.id, binder.id, 1)

    const lista = await listUnallocated(testPrisma(), user)

    expect(lista).toHaveLength(1)
    expect(lista[0]).toMatchObject({ cardCode: 'OP01-001', owned: 4, allocated: 1, loose: 3 })
  })

  it('nao ve a colecao de outra pessoa', async () => {
    const dono = await owner('Dono')
    const outro = await owner('Outro')
    const { variant } = await createCardWithVariant()
    await own(dono.collectionId, variant.id, 3)

    expect(await countUnallocated(testPrisma(), outro.user)).toEqual({ copies: 0, cards: 0 })
    expect(await listUnallocated(testPrisma(), outro.user)).toEqual([])
  })
})

describe('acrescentar copias a um local', () => {
  it('soma ao que ja estava ali', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant()
    await own(collectionId, variant.id, 4)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')
    await setAllocation(testPrisma(), user, variant.id, binder.id, 1)

    const resultado = await addAllocation(testPrisma(), user, variant.id, binder.id, 2)

    expect(resultado).toEqual({ quantity: 3, removed: false })
  })

  it('cria a alocacao quando ainda nao ha nenhuma', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant()
    await own(collectionId, variant.id, 2)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')

    await addAllocation(testPrisma(), user, variant.id, binder.id, 2)

    const estado = await listVariantAllocations(testPrisma(), user, variant.id)
    expect(estado).toMatchObject({ allocated: 2, unallocated: 0 })
  })

  /** A invariante vale igual por este caminho. */
  it('recusa acrescentar alem do que se possui', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant()
    await own(collectionId, variant.id, 3)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION', 'Binder')
    const caixa = await createStorage(user.id, 'BOX', 'COLLECTION', 'Caixa')
    await setAllocation(testPrisma(), user, variant.id, binder.id, 2)

    const erro = await addAllocation(testPrisma(), user, variant.id, caixa.id, 2).catch(
      (e: unknown) => e,
    )

    expect(erro).toBeInstanceOf(ConflictError)
    expect((erro as ConflictError).code).toBe(ALLOCATION_EXCEEDS_OWNED)
  })

  it('recusa acrescentar zero ou menos', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant()
    await own(collectionId, variant.id, 2)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')

    await expect(
      addAllocation(testPrisma(), user, variant.id, binder.id, 0),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  /**
   * Duas telas guardando a mesma carta ao mesmo tempo somam sobre a leitura
   * feita **dentro** do lock. Se o total viesse do cliente, a segunda escrita
   * gravaria por cima da primeira em vez de somar a ela.
   */
  it('duas adicoes simultaneas somam, e nao se sobrescrevem', async () => {
    const { user, collectionId } = await owner()
    const { variant } = await createCardWithVariant()
    await own(collectionId, variant.id, 4)
    const binder = await createStorage(user.id, 'BINDER', 'COLLECTION')

    await Promise.all([
      addAllocation(testPrisma(), user, variant.id, binder.id, 2),
      addAllocation(testPrisma(), user, variant.id, binder.id, 2),
    ])

    const estado = await listVariantAllocations(testPrisma(), user, variant.id)
    expect(estado.allocated).toBe(4)
  })
})
