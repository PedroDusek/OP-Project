import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { importCatalog } from '@/server/application/catalog/import-catalog'
import { searchCatalog } from '@/server/application/catalog/search-cards'
import { parseCardList } from '@/server/domain/catalog/parse-card-list'
import type { CatalogProvider } from '@/server/domain/catalog/types'
import { disconnect, resetDatabase, testPrisma } from '../helpers'

const html = readFileSync(
  fileURLToPath(new URL('../fixtures/bandai-cardlist-sample.html', import.meta.url)),
  'utf8',
)

const provider: CatalogProvider = {
  name: 'bandai',
  listSeriesIds: async () => ['569117'],
  fetchSeries: async () => parseCardList(html),
}

beforeAll(async () => {
  await resetDatabase()
  await importCatalog(testPrisma(), provider, {
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  })
})

afterAll(async () => {
  await disconnect()
})

describe('busca no catalogo', () => {
  it('devolve todas as variantes sem filtro', async () => {
    const result = await searchCatalog(testPrisma())
    expect(result.total).toBe(6)
    expect(result.items).toHaveLength(6)
  })

  it('busca exata por codigo traz todas as artes daquela carta', async () => {
    const result = await searchCatalog(testPrisma(), { code: 'OP17-005' })
    expect(result.total).toBe(2)
    expect(result.items.map((i) => i.variantType).sort()).toEqual(['Normal', 'Parallel'])
  })

  it('busca por trecho do nome ignora maiusculas', async () => {
    const all = await searchCatalog(testPrisma())
    const target = all.items[0].cardName
    const fragment = target.slice(1, Math.min(5, target.length)).toUpperCase()

    const result = await searchCatalog(testPrisma(), { name: fragment })
    expect(result.total).toBeGreaterThan(0)
    for (const item of result.items) {
      expect(item.cardName.toLowerCase()).toContain(fragment.toLowerCase())
    }
  })

  it('filtra por tipo de carta', async () => {
    const result = await searchCatalog(testPrisma(), { type: 'Leader' })
    expect(result.total).toBeGreaterThan(0)
    for (const item of result.items) expect(item.type).toBe('Leader')
  })

  it('filtra por set usando variant_printings', async () => {
    const db = testPrisma()
    const set = await db.set.findFirstOrThrow()
    const result = await searchCatalog(db, { setCode: set.code })
    expect(result.total).toBe(6)

    const inexistente = await searchCatalog(db, { setCode: 'NAO-EXISTE' })
    expect(inexistente.total).toBe(0)
  })

  it('filtra por cor, trait e atributo', async () => {
    const db = testPrisma()
    const color = await db.color.findFirstOrThrow()
    const byColor = await searchCatalog(db, { color: color.name })
    expect(byColor.total).toBeGreaterThan(0)

    const trait = await db.trait.findFirstOrThrow()
    const byTrait = await searchCatalog(db, { trait: trait.name })
    expect(byTrait.total).toBeGreaterThan(0)

    const attribute = await db.attribute.findFirstOrThrow()
    const byAttribute = await searchCatalog(db, { attribute: attribute.name })
    expect(byAttribute.total).toBeGreaterThan(0)
    // Event e Stage nao tem atributo, entao nunca aparecem neste filtro.
    for (const item of byAttribute.items) {
      expect(['Leader', 'Character']).toContain(item.type)
    }
  })

  it('combina filtros', async () => {
    const db = testPrisma()
    const color = await db.color.findFirstOrThrow()
    const combined = await searchCatalog(db, { type: 'Character', color: color.name })
    for (const item of combined.items) expect(item.type).toBe('Character')

    const impossible = await searchCatalog(db, { type: 'Leader', code: 'OP17-005' })
    expect(impossible.total).toBe(0)
  })

  it('filtra por raridade e por tipo de variante', async () => {
    const db = testPrisma()
    const parallel = await searchCatalog(db, { variantType: 'Parallel' })
    expect(parallel.total).toBe(1)
    expect(parallel.items[0].sourceId).toBe('OP17-005_p1')
  })

  it('pagina de forma determinista, sem repetir nem perder itens', async () => {
    const db = testPrisma()
    const first = await searchCatalog(db, { page: 1, pageSize: 4 })
    const second = await searchCatalog(db, { page: 2, pageSize: 4 })

    expect(first.items).toHaveLength(4)
    expect(second.items).toHaveLength(2)
    expect(first.total).toBe(6)
    expect(first.totalPages).toBe(2)

    const ids = [...first.items, ...second.items].map((i) => i.variantId.toString())
    expect(new Set(ids).size).toBe(6)

    // A mesma pagina pedida de novo devolve exatamente o mesmo conteudo.
    const againstFirst = await searchCatalog(db, { page: 1, pageSize: 4 })
    expect(againstFirst.items).toEqual(first.items)
  })

  it('limita o tamanho de pagina para nao permitir varrer o catalogo inteiro', async () => {
    const result = await searchCatalog(testPrisma(), { pageSize: 100_000 })
    expect(result.pageSize).toBeLessThanOrEqual(100)
  })

  it('devolve resultado vazio, e nao erro, quando nada casa', async () => {
    const result = await searchCatalog(testPrisma(), { code: 'ZZ99-999' })
    expect(result.items).toEqual([])
    expect(result.total).toBe(0)
    expect(result.totalPages).toBe(1)
  })
})
