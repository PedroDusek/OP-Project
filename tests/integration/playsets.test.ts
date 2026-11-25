import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { listPlaysetSets, searchPlaysets } from '@/server/application/collection/read-playsets'
import { setCollectionQuantity } from '@/server/application/collection/set-quantity'
import type { AuthenticatedUser } from '@/server/application/auth'
import {
  createCard,
  createCardWithVariant,
  createUser,
  createVariant,
  disconnect,
  resetDatabase,
  testPrisma,
} from '../helpers'

/**
 * Playsets com o universo do catálogo (decisão 114).
 *
 * O que muda em relação ao que existia: a consulta **não** parte da coleção. Ela
 * parte das cartas e traz a coleção por fora, e é isso que faz o `0/4` existir.
 * Um teste que só criasse cartas possuídas não verificaria nada disso.
 *
 * A aritmética por carta está em `tests/domain/collection-playsets.test.ts`, sem
 * banco. Aqui se verifica o que só o banco garante: a participação no set vem de
 * `variant_printings`, e a soma do playset atravessa sets.
 */

async function dono(name = 'Dono'): Promise<AuthenticatedUser> {
  const created = await createUser(name)
  return {
    id: created.id,
    email: `${name.toLowerCase()}@example.test`,
    name,
    // Decisao 093: playset e analise da colecao, e analise e Premium.
    plan: 'PREMIUM',
    premiumUntil: null,
  }
}

async function criarSet(code: string) {
  return testPrisma().set.create({ data: { code, name: code } })
}

async function imprimir(cardVariantId: bigint, setId: bigint) {
  return testPrisma().variantPrinting.create({ data: { cardVariantId, setId } })
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('searchPlaysets', () => {
  /*
   * O motivo da tela existir. Antes da decisao 114 este caso era impossivel:
   * a consulta saia de `collection_items`, e uma carta que a pessoa nao tem nao
   * tem linha la.
   */
  it('a carta que a pessoa não tem aparece em zero', async () => {
    const user = await dono()
    const set = await criarSet('OP01')
    const { variant } = await createCardWithVariant('Character', 'OP01-001')
    await imprimir(variant.id, set.id)

    const rows = await searchPlaysets(testPrisma(), user, 'OP01')

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ cardCode: 'OP01-001', quantity: 0, closed: false })
  })

  it('soma as cópias de todas as artes da carta', async () => {
    const user = await dono()
    const set = await criarSet('OP01')
    const card = await createCard('Character', 'OP01-001')
    const normal = await createVariant(card.id)
    const paralela = await createVariant(card.id, 'Parallel')
    await imprimir(normal.id, set.id)
    await imprimir(paralela.id, set.id)

    await setCollectionQuantity(testPrisma(), user, normal.id, 3)
    await setCollectionQuantity(testPrisma(), user, paralela.id, 1)

    const rows = await searchPlaysets(testPrisma(), user, 'OP01')

    // Uma linha, e nao duas: a linha e a **carta**.
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ quantity: 4, closed: true, otherArtCopies: 1 })
  })

  /**
   * A armadilha que custaria o numero errado sem ninguem notar.
   *
   * A regra 2.1 soma **todas** as artes da carta, impressas onde for. Uma arte
   * paralela que saiu so em OP-09 conta no playset de uma carta reimpressa em
   * OP-18. Se a segunda consulta fosse escopada pelo set pedido, este teste
   * veria 3/4 e a tela diria que falta uma copia que a pessoa tem.
   */
  it('a soma atravessa sets: arte impressa em outro set também conta', async () => {
    const user = await dono()
    const antigo = await criarSet('OP09')
    const novo = await criarSet('OP18')
    const card = await createCard('Character', 'OP09-001')
    const normal = await createVariant(card.id)
    const paralela = await createVariant(card.id, 'Parallel')

    // A Normal foi reimpressa na colecao nova; a paralela ficou so na antiga.
    await imprimir(normal.id, antigo.id)
    await imprimir(normal.id, novo.id)
    await imprimir(paralela.id, antigo.id)

    await setCollectionQuantity(testPrisma(), user, normal.id, 3)
    await setCollectionQuantity(testPrisma(), user, paralela.id, 1)

    const rows = await searchPlaysets(testPrisma(), user, 'OP18')

    expect(rows[0]).toMatchObject({ quantity: 4, closed: true, otherArtCopies: 1 })
  })

  it('Leader e DON!! não aparecem: nunca contam playset', async () => {
    const user = await dono()
    const set = await criarSet('OP01')
    const personagem = await createCardWithVariant('Character', 'OP01-001')
    const lider = await createCardWithVariant('Leader', 'OP01-002')
    await imprimir(personagem.variant.id, set.id)
    await imprimir(lider.variant.id, set.id)

    const rows = await searchPlaysets(testPrisma(), user, 'OP01')

    expect(rows.map((row) => row.cardCode)).toEqual(['OP01-001'])
  })

  it('a participação no set vem de variant_printings, e não do prefixo do código', async () => {
    const user = await dono()
    const set = await criarSet('EB04')
    const { variant } = await createCardWithVariant('Character', 'OP14-001')
    await imprimir(variant.id, set.id)

    const rows = await searchPlaysets(testPrisma(), user, 'EB04')

    expect(rows.map((row) => row.cardCode)).toEqual(['OP14-001'])
  })

  /**
   * Raridade e tipo de arte sao da **variante**, e a linha soma todas as artes:
   * aceitar o filtro faria um `2/4` significar duas copias Normal numa tela que
   * diz estar mostrando arte paralela. A tela nao os oferece, e o caso de uso os
   * descarta para quem monta o endereco a mao.
   */
  it('o filtro de arte é descartado, e não muda a conta', async () => {
    const user = await dono()
    const set = await criarSet('OP01')
    const card = await createCard('Character', 'OP01-001')
    const normal = await createVariant(card.id)
    const paralela = await createVariant(card.id, 'Parallel')
    await imprimir(normal.id, set.id)
    await imprimir(paralela.id, set.id)

    await setCollectionQuantity(testPrisma(), user, normal.id, 4)

    const comFiltro = await searchPlaysets(testPrisma(), user, 'OP01', {
      // @ts-expect-error — `PlaysetFilters` nao aceita isto; o teste é de quem burla.
      variantType: 'Parallel',
      rarity: 'SR',
    })

    expect(comFiltro).toHaveLength(1)
    expect(comFiltro[0]).toMatchObject({ quantity: 4, closed: true })
  })

  it('o filtro de carta funciona: só o tipo pedido', async () => {
    const user = await dono()
    const set = await criarSet('OP01')
    const personagem = await createCardWithVariant('Character', 'OP01-001')
    const evento = await createCardWithVariant('Event', 'OP01-002')
    await imprimir(personagem.variant.id, set.id)
    await imprimir(evento.variant.id, set.id)

    const rows = await searchPlaysets(testPrisma(), user, 'OP01', { type: 'Event' })

    expect(rows.map((row) => row.cardCode)).toEqual(['OP01-002'])
  })

  it('o set vazio devolve lista vazia, e não erro', async () => {
    const user = await dono()
    await criarSet('OP01')

    expect(await searchPlaysets(testPrisma(), user, 'OP01')).toEqual([])
  })
})

describe('listPlaysetSets', () => {
  it('conta, por coleção, quantas cartas fecharam', async () => {
    const user = await dono()
    const set = await criarSet('OP01')
    const fechada = await createCardWithVariant('Character', 'OP01-001')
    const aberta = await createCardWithVariant('Character', 'OP01-002')
    await imprimir(fechada.variant.id, set.id)
    await imprimir(aberta.variant.id, set.id)

    await setCollectionQuantity(testPrisma(), user, fechada.variant.id, 4)
    await setCollectionQuantity(testPrisma(), user, aberta.variant.id, 1)

    const { sets } = await listPlaysetSets(testPrisma(), user)

    expect(sets).toHaveLength(1)
    expect(sets[0]).toMatchObject({ code: 'OP01', total: 2, closed: 1 })
  })

  /**
   * O total **nao** e a soma das colecoes.
   *
   * Uma carta reimpressa pertence a dois sets e conta nos dois — somar os
   * `total` daria 2 para uma carta so. O total vem contado sobre cartas
   * distintas, e e este teste que guarda a diferenca.
   */
  it('o total conta cartas distintas, mesmo a reimpressa em dois sets', async () => {
    const user = await dono()
    const antigo = await criarSet('OP09')
    const novo = await criarSet('OP18')
    const { variant } = await createCardWithVariant('Character', 'OP09-001')
    await imprimir(variant.id, antigo.id)
    await imprimir(variant.id, novo.id)

    await setCollectionQuantity(testPrisma(), user, variant.id, 4)

    const { sets, total, closed } = await listPlaysetSets(testPrisma(), user)

    // Nos dois sets, uma carta cada.
    expect(sets.map((set) => [set.code, set.total, set.closed])).toEqual([
      ['OP09', 1, 1],
      ['OP18', 1, 1],
    ])
    // E uma carta no total, nao duas.
    expect({ total, closed }).toEqual({ total: 1, closed: 1 })
  })

  /**
   * Sem caso especial nenhum no codigo: toda carta do set dos DON!! e do tipo
   * `DON`, que nunca conta playset (decisao 112), entao o set termina sem
   * nenhuma carta no universo e nao entra na lista.
   */
  it('uma coleção só de cartas sem playset não aparece', async () => {
    const user = await dono()
    const set = await criarSet('OP01')
    const don = await criarSet('DON')

    const personagem = await createCardWithVariant('Character', 'OP01-001')
    await imprimir(personagem.variant.id, set.id)

    const carta = await testPrisma().card.create({
      data: { code: 'DON-001', name: 'DON!!', type: 'DON' },
    })
    const variante = await createVariant(carta.id)
    await imprimir(variante.id, don.id)

    const { sets } = await listPlaysetSets(testPrisma(), user)

    expect(sets.map((item) => item.code)).toEqual(['OP01'])
  })

  it('coleção vazia devolve zero fechados, e não quebra', async () => {
    const user = await dono()
    const set = await criarSet('OP01')
    const { variant } = await createCardWithVariant('Character', 'OP01-001')
    await imprimir(variant.id, set.id)

    const { sets, total, closed } = await listPlaysetSets(testPrisma(), user)

    expect(sets[0]).toMatchObject({ total: 1, closed: 0 })
    expect({ total, closed }).toEqual({ total: 1, closed: 0 })
  })
})
