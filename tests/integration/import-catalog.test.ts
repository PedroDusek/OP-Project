import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { importCatalog } from '@/server/application/catalog/import-catalog'
import { parseCardList } from '@/server/domain/catalog/parse-card-list'
import type { CatalogPage, CatalogProvider } from '@/server/domain/catalog/types'
import { disconnect, resetDatabase, testPrisma } from '../helpers'

const html = readFileSync(
  fileURLToPath(new URL('../fixtures/bandai-cardlist-sample.html', import.meta.url)),
  'utf8',
)

/** Provedor de teste: nada de rede, o mesmo recorte real da fonte. */
function fakeProvider(page: CatalogPage = parseCardList(html)): CatalogProvider {
  return {
    name: 'bandai',
    listSeriesIds: async () => ['569117'],
    fetchSeries: async () => page,
  }
}

const silent = { info: () => {}, warn: () => {}, error: () => {} }

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('importacao do catalogo', () => {
  it('grava cartas, variantes, sets e vocabulario', async () => {
    const db = testPrisma()
    const report = await importCatalog(db, fakeProvider(), { logger: silent })

    expect(report.seriesFailed).toBe(0)
    expect(report.rejected).toEqual([])
    expect(await db.card.count()).toBe(5)
    expect(await db.cardVariant.count()).toBe(6)
    expect(await db.set.count()).toBeGreaterThan(0)
    expect(await db.color.count()).toBeGreaterThan(0)
    expect(await db.trait.count()).toBeGreaterThan(0)
  })

  it('e idempotente: rodar duas vezes nao duplica nada', async () => {
    const db = testPrisma()
    const provider = fakeProvider()

    await importCatalog(db, provider, { logger: silent })
    const first = await snapshot()

    await importCatalog(db, provider, { logger: silent })
    const second = await snapshot()

    expect(second).toEqual(first)
  })

  it('e idempotente na terceira execucao tambem', async () => {
    const db = testPrisma()
    const provider = fakeProvider()
    await importCatalog(db, provider, { logger: silent })
    await importCatalog(db, provider, { logger: silent })
    const before = await snapshot()
    await importCatalog(db, provider, { logger: silent })
    expect(await snapshot()).toEqual(before)
  })

  it('mantem o id interno da variante estavel entre execucoes', async () => {
    // E isto que o identificador externo compra: reimportar nao recria linhas,
    // entao a colecao de quem ja possui a carta continua apontando para ela.
    const db = testPrisma()
    const provider = fakeProvider()

    await importCatalog(db, provider, { logger: silent })
    const before = await db.cardVariant.findMany({
      select: { id: true, sourceId: true },
      orderBy: { sourceId: 'asc' },
    })

    await importCatalog(db, provider, { logger: silent })
    const after = await db.cardVariant.findMany({
      select: { id: true, sourceId: true },
      orderBy: { sourceId: 'asc' },
    })

    expect(after).toEqual(before)
  })

  it('nao quebra a posse de quem ja tem a carta ao reimportar', async () => {
    const db = testPrisma()
    const provider = fakeProvider()
    await importCatalog(db, provider, { logger: silent })

    const variant = await db.cardVariant.findFirstOrThrow()
    const user = await db.user.create({
      data: {
        name: 'Colecionador',
        email: 'colecionador@example.test',
        collection: { create: { name: 'Minha Colecao' } },
      },
      include: { collection: true },
    })
    await db.collectionItem.create({
      data: { collectionId: user.collection!.id, cardVariantId: variant.id, quantity: 3 },
    })

    await importCatalog(db, provider, { logger: silent })

    const item = await db.collectionItem.findFirstOrThrow()
    expect(item.cardVariantId).toBe(variant.id)
    expect(item.quantity).toBe(3)
  })

  it('atualiza dados alterados na fonte sem criar linha nova', async () => {
    const db = testPrisma()
    await importCatalog(db, fakeProvider(), { logger: silent })
    const before = await db.card.findFirstOrThrow({ where: { code: 'OP17-005' } })

    const page = parseCardList(html)
    const changed: CatalogPage = {
      ...page,
      cards: page.cards.map((c) =>
        c.code === 'OP17-005' ? { ...c, name: 'Nome Corrigido', power: 9999 } : c,
      ),
    }
    await importCatalog(db, fakeProvider(changed), { logger: silent })

    const after = await db.card.findFirstOrThrow({ where: { code: 'OP17-005' } })
    expect(after.id).toBe(before.id)
    expect(after.name).toBe('Nome Corrigido')
    expect(after.power).toBe(9999)
    expect(await db.card.count()).toBe(5)
  })

  it('remove vocabulario que saiu da fonte, sem apagar o termo em si', async () => {
    const db = testPrisma()
    await importCatalog(db, fakeProvider(), { logger: silent })

    const page = parseCardList(html)
    const stripped: CatalogPage = {
      ...page,
      cards: page.cards.map((c) => (c.code === 'OP17-005' ? { ...c, traits: ['Straw Hat Crew'] } : c)),
    }
    await importCatalog(db, fakeProvider(stripped), { logger: silent })

    const card = await db.card.findFirstOrThrow({
      where: { code: 'OP17-005' },
      include: { traits: { include: { trait: true } } },
    })
    expect(card.traits.map((t) => t.trait.name)).toEqual(['Straw Hat Crew'])
  })

  it('relata a falha de uma serie sem abortar as demais', async () => {
    const db = testPrisma()
    const page = parseCardList(html)
    const provider: CatalogProvider = {
      name: 'bandai',
      listSeriesIds: async () => ['a', 'b'],
      fetchSeries: async (id) => {
        if (id === 'a') throw new Error('origem indisponivel')
        return page
      },
    }

    const report = await importCatalog(db, provider, { logger: silent })

    expect(report.seriesFailed).toBe(1)
    expect(report.seriesProcessed).toBe(1)
    expect(report.failures[0].seriesId).toBe('a')
    expect(await db.card.count()).toBe(5)
  })

  it('desfaz a serie inteira quando um registro dela falha', async () => {
    const db = testPrisma()
    const page = parseCardList(html)
    const broken: CatalogPage = {
      ...page,
      // Tipo invalido: o CHECK do banco rejeita e a transacao inteira volta.
      cards: page.cards.map((c, i) => (i === 3 ? { ...c, type: 'Don' as never } : c)),
    }

    const report = await importCatalog(db, fakeProvider(broken), { logger: silent })

    expect(report.seriesFailed).toBe(1)
    // Nenhuma carta da serie sobreviveu: nao ficou catalogo pela metade.
    expect(await db.card.count()).toBe(0)
    expect(await db.cardVariant.count()).toBe(0)
  })
})

async function snapshot() {
  const db = testPrisma()
  return {
    cards: await db.card.count(),
    variants: await db.cardVariant.count(),
    sets: await db.set.count(),
    printings: await db.variantPrinting.count(),
    colors: await db.color.count(),
    traits: await db.trait.count(),
    attributes: await db.attribute.count(),
    mechanics: await db.mechanic.count(),
    cardColors: await db.cardColor.count(),
    cardTraits: await db.cardTrait.count(),
    cardAttributes: await db.cardAttribute.count(),
    cardMechanics: await db.cardMechanic.count(),
  }
}
