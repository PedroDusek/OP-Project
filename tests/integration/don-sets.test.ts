import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { applyDonSets, recordDonSets } from '@/server/application/catalog/don-sets'
import { disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * A tabela de coleções dos DON!! aplicada ao banco (decisão 112).
 *
 * Os DON!! saem junto das coleções, e o dono do produto os vincula à mão. O
 * arquivo é a verdade; o banco recebe o que ele diz.
 */

let path: string

beforeAll(async () => {
  await resetDatabase()
  const prisma = testPrisma()

  await prisma.set.createMany({
    data: [
      { code: 'DON', name: 'DON!!' },
      { code: 'OP01', name: 'ROMANCE DAWN' },
    ],
  })

  const card = await prisma.card.create({
    data: { code: 'DON-482236', name: 'DON!! Card (Luffy)', type: 'DON' },
  })
  const setDon = await prisma.set.findUniqueOrThrow({ where: { code: 'DON' } })
  const variant = await prisma.cardVariant.create({
    data: { cardId: card.id, variantType: 'Parallel', source: 'tcgcsv-don', sourceId: '482236' },
  })
  await prisma.variantPrinting.create({ data: { cardVariantId: variant.id, setId: setDon.id } })

  path = join(mkdtempSync(join(tmpdir(), 'don-sets-')), 'don-sets.json')
  writeFileSync(path, JSON.stringify({ cartas: [] }), 'utf8')
})

afterAll(async () => {
  await disconnect()
})

async function impressoes(): Promise<string[]> {
  const v = await testPrisma().cardVariant.findFirstOrThrow({
    where: { sourceId: '482236' },
    select: { printings: { select: { set: { select: { code: true } } } } },
  })
  return v.printings.map((p) => p.set.code).sort()
}

describe('gravar em que colecao um DON saiu', () => {
  it('grava no arquivo e a importacao poe a impressao', async () => {
    await recordDonSets(testPrisma(), '482236', ['OP01'], path)
    const resultado = await applyDonSets(testPrisma(), path)

    expect(resultado).toMatchObject({ entries: 1, printings: 1, unknownArts: [], unknownSets: [] })
    expect(await impressoes()).toEqual(['DON', 'OP01'])
  })

  /* Rodar de novo nao duplica: a chave composta e o que torna isto idempotente. */
  it('aplicar duas vezes da o mesmo resultado', async () => {
    await applyDonSets(testPrisma(), path)
    expect(await impressoes()).toEqual(['DON', 'OP01'])
  })

  it('recusa set que nao existe', async () => {
    await expect(recordDonSets(testPrisma(), '482236', ['OP99'], path)).rejects.toThrow(
      /Set não encontrado/,
    )
  })

  /* O set DON e automatico: oferece-lo faria parecer que da para tirar a carta de la. */
  it('recusa o set artificial DON', async () => {
    await expect(recordDonSets(testPrisma(), '482236', ['DON'], path)).rejects.toThrow(/automático/)
  })

  it('recusa arte que nao e um DON do catalogo', async () => {
    await expect(recordDonSets(testPrisma(), '999999', ['OP01'], path)).rejects.toThrow(
      /não é um DON/,
    )
  })

  /*
   * Tirar a arte da tabela **nao** apaga a impressao que ela ganhou: apagar
   * exigiria decidir o que fazer com a colecao de quem ja via a carta ali, e
   * isso e conversa, nao efeito colateral de importacao.
   */
  it('tirar da tabela nao apaga a impressao ja gravada', async () => {
    await recordDonSets(testPrisma(), '482236', [], path)
    const resultado = await applyDonSets(testPrisma(), path)

    expect(resultado.entries).toBe(0)
    expect(await impressoes()).toEqual(['DON', 'OP01'])
  })
})
