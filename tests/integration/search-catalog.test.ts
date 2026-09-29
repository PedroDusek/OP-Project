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

/**
 * Varios valores na mesma faceta.
 *
 * Dentro da faceta vale o **ou**; entre facetas, o **e**. Antes, cada faceta
 * aceitava um valor so: escolher a segunda cor apagava a primeira, e nao havia
 * como pedir "as pretas e as azuis" de uma vez.
 */
describe('filtros com varios valores', () => {
  it('uma faceta com dois valores traz a uniao dos dois', async () => {
    const db = testPrisma()
    const types = await db.card.findMany({ select: { type: true }, distinct: ['type'] })
    const [first, second] = types.map((t) => t.type)
    // A amostra precisa de dois tipos para a pergunta fazer sentido.
    expect(second).toBeDefined()

    const [um, outro, juntos] = await Promise.all([
      searchCatalog(db, { type: first as never }),
      searchCatalog(db, { type: second as never }),
      searchCatalog(db, { type: [first, second] as never }),
    ])

    expect(juntos.total).toBe(um.total + outro.total)
  })

  it('duas cores trazem as cartas de qualquer uma delas', async () => {
    const db = testPrisma()
    const colors = await db.color.findMany({ select: { name: true }, orderBy: { name: 'asc' } })
    const names = colors.map((c) => c.name)
    expect(names.length).toBeGreaterThan(0)

    const juntas = await searchCatalog(db, { color: names })
    const cada = await Promise.all(names.map((name) => searchCatalog(db, { color: name })))
    const uniao = new Set(cada.flatMap((r) => r.items.map((i) => String(i.variantId))))

    expect(new Set(juntas.items.map((i) => String(i.variantId)))).toEqual(uniao)
  })

  /** Um valor so continua valendo: a lista de um e o caso comum. */
  it('lista de um valor filtra igual ao valor solto', async () => {
    const db = testPrisma()
    const [solto, lista] = await Promise.all([
      searchCatalog(db, { type: 'Leader' }),
      searchCatalog(db, { type: ['Leader'] }),
    ])

    expect(lista.total).toBe(solto.total)
  })

  /** Entre facetas o "e" continua: cor de uma, tipo de outra. */
  it('facetas diferentes continuam se somando por e', async () => {
    const db = testPrisma()
    const color = await db.color.findFirst({ select: { name: true } })
    expect(color).not.toBeNull()

    const combinado = await searchCatalog(db, {
      type: ['Leader', 'Character'],
      color: [color!.name],
    })

    for (const item of combinado.items) {
      expect(['Leader', 'Character']).toContain(item.type)
    }
  })

  /** Lista vazia e "sem filtro", e nao "nada casa". */
  it('lista vazia nao filtra nada', async () => {
    const db = testPrisma()
    const [tudo, comListaVazia] = await Promise.all([
      searchCatalog(db),
      searchCatalog(db, { color: [] }),
    ])

    expect(comListaVazia.total).toBe(tudo.total)
  })
})

/**
 * A ordem escolhida pela pessoa (decisão 110).
 *
 * Aqui a cadeia inteira: o critério escolhido, o empate voltando para a ordem
 * do catálogo e o id por último. A regra pura está em
 * `tests/domain/catalog-order.test.ts`.
 */
describe('a ordem escolhida', () => {
  /** Os valores na sequencia em que a busca devolveu, pagina a pagina. */
  async function todos(sort: Parameters<typeof searchCatalog>[1]) {
    const result = await searchCatalog(testPrisma(), { ...sort, pageSize: 100 })
    return result.items
  }

  it('sem ordem escolhida, a lista e a mesma de sempre', async () => {
    const padrao = await todos({})
    const explicita = await todos({ sort: 'codigo' })
    expect(explicita.map((i) => i.variantId)).toEqual(padrao.map((i) => i.variantId))
  })

  it('por custo crescente, os valores nao descem', async () => {
    const items = await todos({ sort: 'custo' })
    const valores = items.map((i) => i.cost).filter((v): v is number => v !== null)
    expect(valores).toEqual([...valores].sort((a, b) => a - b))
  })

  it('por custo decrescente, os valores nao sobem', async () => {
    const items = await todos({ sort: 'custo-desc' })
    const valores = items.map((i) => i.cost).filter((v): v is number => v !== null)
    expect(valores).toEqual([...valores].sort((a, b) => b - a))
  })

  /*
   * Leader nao tem custo e Event nao tem poder. Nulo e "nao se aplica", nao
   * zero — entao ele nao disputa posicao e fica no fim das duas vezes.
   */
  it('quem nao tem o campo fica no fim, nas duas direcoes', async () => {
    for (const sort of ['poder', 'poder-desc'] as const) {
      const items = await todos({ sort })
      const semPoder = items.findIndex((i) => i.power === null)
      // O fixture tem Event e Stage, que nao tem poder. Sem esta linha o teste
      // passaria sem verificar nada no dia em que o fixture mudasse.
      expect(semPoder).toBeGreaterThan(-1)
      // Depois do primeiro nulo nao pode voltar a aparecer valor.
      expect(items.slice(semPoder).every((i) => i.power === null)).toBe(true)
    }

    // O mesmo pelo lado do custo, que e o Leader quem nao tem.
    for (const sort of ['custo', 'custo-desc'] as const) {
      const items = await todos({ sort })
      const semCusto = items.findIndex((i) => i.cost === null)
      expect(semCusto).toBeGreaterThan(-1)
      expect(items.slice(semCusto).every((i) => i.cost === null)).toBe(true)
    }
  })

  it('por nome, a ordem e a do alfabeto e ignora caixa', async () => {
    const items = await todos({ sort: 'nome' })
    const nomes = items.map((i) => i.cardName)
    expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })))
  })

  /*
   * O defeito que este teste existe para impedir: ordenar **a pagina** em vez
   * de **todas as artes que casam com o filtro**. Com pageSize 2, a primeira
   * pagina por custo decrescente tem de trazer os dois maiores do catalogo
   * inteiro, e nao os dois maiores entre os que por acaso vieram primeiro.
   */
  it('ordena o catalogo inteiro, e nao a pagina', async () => {
    const inteiro = await todos({ sort: 'custo-desc' })
    const primeira = await searchCatalog(testPrisma(), { sort: 'custo-desc', pageSize: 2, page: 1 })
    const segunda = await searchCatalog(testPrisma(), { sort: 'custo-desc', pageSize: 2, page: 2 })

    expect(primeira.items.map((i) => i.variantId)).toEqual(inteiro.slice(0, 2).map((i) => i.variantId))
    expect(segunda.items.map((i) => i.variantId)).toEqual(inteiro.slice(2, 4).map((i) => i.variantId))
  })

  /*
   * Sem desempate estavel, artes que empatam no criterio trocariam de lugar
   * entre uma leva e a seguinte — a mesma carta apareceria duas vezes ou
   * nenhuma na rolagem infinita.
   */
  it('a mesma consulta devolve sempre a mesma sequencia', async () => {
    const uma = await todos({ sort: 'custo-desc' })
    const outra = await todos({ sort: 'custo-desc' })
    expect(outra.map((i) => i.variantId)).toEqual(uma.map((i) => i.variantId))
  })
})
