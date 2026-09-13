import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { AuthenticatedUser } from '@/server/application/auth'
import { searchCatalog } from '@/server/application/catalog/search-cards'
import { searchCollection } from '@/server/application/collection/read-collection'
import { listWants } from '@/server/application/wants/read-wants'
import { createUser, disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * A ordem contra o banco, com o arranjo que denunciou o defeito (decisão 069).
 *
 * A `OP01-073` normal foi impressa na OP01 e no ST-17, e a listagem pegava a
 * primeira impressão que o banco devolvia: na tela da OP01 ela ia para o fim,
 * depois da `OP01-121`. E as artes da Nami foram importadas fora de ordem, então
 * o desempate por id punha a `_p2` antes da normal.
 *
 * As impressões são criadas na ordem que reproduz os dois: a do ST-17 primeiro,
 * e as artes da Nami de trás para a frente.
 */

let sets: Record<string, bigint>

async function arte(cardId: bigint, sourceId: string, ...setCodes: string[]) {
  return testPrisma().cardVariant.create({
    data: {
      cardId,
      sourceId,
      variantType: sourceId.includes('_p') ? 'Parallel' : 'Normal',
      printings: { create: setCodes.map((code) => ({ setId: sets[code] })) },
    },
  })
}

async function carta(code: string) {
  return testPrisma().card.create({ data: { code, name: `Carta ${code}`, type: 'Character' } })
}

beforeEach(async () => {
  await resetDatabase()
  const db = testPrisma()
  sets = {}
  for (const code of ['OP01', 'ST-17', 'OP05']) {
    sets[code] = (await db.set.create({ data: { code, name: code } })).id
  }

  const nami = await carta('OP01-016')
  await arte(nami.id, 'OP01-016_p4', 'OP05')
  await arte(nami.id, 'OP01-016_p2', 'OP01')
  await arte(nami.id, 'OP01-016', 'OP01')
  await arte(nami.id, 'OP01-016_p1', 'OP01')

  const doflamingo = await carta('OP01-073')
  await arte(doflamingo.id, 'OP01-073', 'ST-17', 'OP01')
  await arte((await carta('OP01-072')).id, 'OP01-072', 'OP01')
  await arte((await carta('OP01-121')).id, 'OP01-121', 'OP01')
  await arte((await carta('ST17-001')).id, 'ST17-001', 'ST-17')
})

afterAll(async () => {
  await disconnect()
})

const DENTRO_DA_OP01 = ['OP01-016', 'OP01-016_p1', 'OP01-016_p2', 'OP01-072', 'OP01-073', 'OP01-121']

async function ordemDoCatalogo(setCode?: string) {
  const { items } = await searchCatalog(testPrisma(), { setCode, pageSize: 100 })
  return items.map((item) => item.sourceId)
}

describe('a ordem de codigo dentro de cada filtro', () => {
  it('na OP01, a carta reimpressa no ST-17 fica no lugar do codigo', async () => {
    expect(await ordemDoCatalogo('OP01')).toEqual(DENTRO_DA_OP01)
  })

  it('no ST-17, a mesma carta aparece entre as do ST-17, por codigo', async () => {
    expect(await ordemDoCatalogo('ST-17')).toEqual(['OP01-073', 'ST17-001'])
  })

  /* Sem filtro: cada arte no set do proprio codigo; a SP impressa so na OP05 fica na OP05. */
  it('sem filtro, por set e depois por codigo', async () => {
    expect(await ordemDoCatalogo()).toEqual([...DENTRO_DA_OP01, 'OP01-016_p4', 'ST17-001'])
  })

  it('vale igual na colecao e na want list', async () => {
    const criado = await createUser('Dono')
    const user: AuthenticatedUser = {
      id: criado.id,
      email: 'dono@example.test',
      name: 'Dono',
      plan: 'FREE',
      premiumUntil: null,
    }
    const variantes = await testPrisma().cardVariant.findMany({ select: { id: true } })
    // De tras para a frente de proposito: a ordem nao pode vir da insercao.
    for (const { id } of [...variantes].reverse()) {
      await testPrisma().collectionItem.create({
        data: { collectionId: criado.collection!.id, cardVariantId: id, quantity: 1 },
      })
      await testPrisma().wantItem.create({ data: { userId: criado.id, cardVariantId: id, quantity: 4 } })
    }

    const sourceIdDe = new Map(
      (await testPrisma().cardVariant.findMany({ select: { id: true, sourceId: true } })).map((v) => [
        String(v.id),
        v.sourceId,
      ]),
    )

    const colecao = await searchCollection(testPrisma(), user, { setCode: 'OP01', pageSize: 100 })
    expect(colecao.items.map((item) => sourceIdDe.get(String(item.variantId)))).toEqual(DENTRO_DA_OP01)

    const wants = await listWants(testPrisma(), user, { setCode: 'OP01' })
    expect(wants.map((want) => sourceIdDe.get(want.variantId))).toEqual(DENTRO_DA_OP01)
  })
})
