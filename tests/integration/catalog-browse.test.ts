import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { importCatalog } from '@/server/application/catalog/import-catalog'
import { searchCatalog } from '@/server/application/catalog/search-cards'
import { getSet, listSets } from '@/server/application/catalog/list-sets'
import { getCatalogVocabulary } from '@/server/application/catalog/vocabulary'
import { parseCardList } from '@/server/domain/catalog/parse-card-list'
import type { CatalogProvider } from '@/server/domain/catalog/types'
import { NotFoundError } from '@/server/domain/errors'
import { disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * Navegacao pelo catalogo: sets, vocabulario dos filtros e as faixas de custo e
 * poder.
 *
 * Roda contra a mesma amostra da Bandai que a suite de importacao usa, entao os
 * numeros vem de dado real, e nao de linhas montadas para o teste passar.
 */

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

describe('listSets', () => {
  it('devolve os sets com a contagem de variantes impressas', async () => {
    const sets = await listSets(testPrisma())

    expect(sets.length).toBeGreaterThan(0)
    for (const set of sets) {
      expect(set.variantCount).toBeGreaterThan(0)
      expect(set.code).not.toBe('')
    }
  })

  /**
   * A contagem sai de `variant_printings`, e nao do prefixo do codigo
   * (`business-rules.md` 2.2). Somar as contagens de todos os sets pode passar
   * do total de variantes justamente porque uma variante reimpressa conta em
   * cada set — e isso e o comportamento correto, nao um erro de contagem.
   */
  it('conta por impressao, nao por prefixo de codigo', async () => {
    const sets = await listSets(testPrisma())
    const printings = await testPrisma().variantPrinting.count()

    expect(sets.reduce((total, set) => total + set.variantCount, 0)).toBe(printings)
  })

  it('expoe o nome da fonte e o nome de exibicao', async () => {
    const sets = await listSets(testPrisma())
    for (const set of sets) {
      expect(typeof set.name).toBe('string')
      expect(set.displayName.startsWith('-')).toBe(false)
    }
  })
})

describe('getSet', () => {
  it('traz um set pelo codigo', async () => {
    const [first] = await listSets(testPrisma())
    const set = await getSet(testPrisma(), first.code)

    expect(set.code).toBe(first.code)
    expect(set.variantCount).toBe(first.variantCount)
  })

  it('recusa codigo que nao existe', async () => {
    await expect(getSet(testPrisma(), 'NAO-EXISTE')).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('vocabulario dos filtros', () => {
  it('sai do catalogo importado', async () => {
    const vocabulary = await getCatalogVocabulary(testPrisma())

    expect(vocabulary.types.length).toBeGreaterThan(0)
    expect(vocabulary.colors.length).toBeGreaterThan(0)
    expect(vocabulary.variantTypes.length).toBeGreaterThan(0)
  })

  /** Decisao 023: o vocabulario de variante e Normal e Parallel, e nada mais. */
  it('nao inventa tipo de variante', async () => {
    const { variantTypes } = await getCatalogVocabulary(testPrisma())
    for (const type of variantTypes) {
      expect(['Normal', 'Parallel']).toContain(type)
    }
  })

  /** Decisao 021: `effects` fica vazia, entao o painel nao tem essa secao. */
  it('nao oferece filtro de efeito', async () => {
    const vocabulary = await getCatalogVocabulary(testPrisma())
    expect(vocabulary).not.toHaveProperty('effects')
    expect(await testPrisma().effect.count()).toBe(0)
  })

  /** Ordem do jogo, do mais comum ao mais raro — nao alfabetica. */
  it('ordena raridade pela ordem do jogo', async () => {
    const { rarities } = await getCatalogVocabulary(testPrisma())
    const common = rarities.indexOf('C')
    const superRare = rarities.indexOf('SR')

    if (common !== -1 && superRare !== -1) expect(common).toBeLessThan(superRare)
  })

  it('devolve as faixas reais de custo e poder', async () => {
    const { costRange, powerRange } = await getCatalogVocabulary(testPrisma())

    if (costRange) expect(costRange.min).toBeLessThanOrEqual(costRange.max)
    if (powerRange) expect(powerRange.min).toBeLessThanOrEqual(powerRange.max)
  })
})

describe('busca unificada', () => {
  it('casa por trecho do codigo', async () => {
    const result = await searchCatalog(testPrisma(), { search: 'OP17' })
    expect(result.total).toBeGreaterThan(0)
    for (const item of result.items) {
      expect(item.cardCode.toUpperCase()).toContain('OP17')
    }
  })

  it('casa por trecho do nome, sem diferenciar maiusculas', async () => {
    const todas = await searchCatalog(testPrisma(), { pageSize: 100 })
    const alvo = todas.items[0]

    const result = await searchCatalog(testPrisma(), {
      search: alvo.cardName.slice(0, 4).toLowerCase(),
    })

    expect(result.items.some((item) => item.cardCode === alvo.cardCode)).toBe(true)
  })

  it('devolve vazio, e nao erro, quando nada casa', async () => {
    const result = await searchCatalog(testPrisma(), { search: 'zzzzzz-nao-existe' })
    expect(result.total).toBe(0)
    expect(result.items).toEqual([])
    expect(result.totalPages).toBe(1)
  })
})

describe('faixas de custo e poder', () => {
  it('um limite so ja filtra', async () => {
    const todas = await searchCatalog(testPrisma(), { pageSize: 100 })
    const custos = todas.items.map((item) => item.cost).filter((c): c is number => c !== null)
    if (custos.length === 0) return

    const teto = Math.min(...custos)
    const result = await searchCatalog(testPrisma(), { costMax: teto, pageSize: 100 })

    expect(result.total).toBeGreaterThan(0)
    for (const item of result.items) {
      if (item.cost !== null) expect(item.cost).toBeLessThanOrEqual(teto)
    }
  })

  it('minimo igual ao maximo continua sendo valor exato', async () => {
    const todas = await searchCatalog(testPrisma(), { pageSize: 100 })
    const alvo = todas.items.find((item) => item.cost !== null)
    if (!alvo?.cost) return

    const result = await searchCatalog(testPrisma(), {
      costMin: alvo.cost,
      costMax: alvo.cost,
      pageSize: 100,
    })

    for (const item of result.items) expect(item.cost).toBe(alvo.cost)
  })

  /**
   * Faixa invertida nao e corrigida em silencio: ela filtra para o conjunto
   * vazio, que e literalmente o que foi pedido. Trocar minimo e maximo por
   * conta propria devolveria resultados que ninguem pediu.
   */
  it('faixa invertida devolve vazio', async () => {
    const result = await searchCatalog(testPrisma(), { costMin: 9, costMax: 2 })
    expect(result.total).toBe(0)
  })
})

describe('classificacao e capa', () => {
  it('classifica cada set e traz a arte da primeira carta', async () => {
    const sets = await listSets(testPrisma())

    for (const set of sets) {
      expect(['collection', 'deck', 'promo']).toContain(set.kind)
      // Todo set da amostra tem carta com imagem, entao tem capa.
      if (set.variantCount > 0) expect(set.coverUrl).toBeTruthy()
    }
  })

  /** A capa e deterministica: a primeira carta por codigo, sempre a mesma. */
  it('escolhe sempre a mesma capa', async () => {
    const primeira = await listSets(testPrisma())
    const segunda = await listSets(testPrisma())

    expect(primeira.map((s) => s.coverUrl)).toEqual(segunda.map((s) => s.coverUrl))
  })

  it('getSet devolve a mesma capa e o mesmo tipo que a lista', async () => {
    const [alvo] = await listSets(testPrisma())
    const set = await getSet(testPrisma(), alvo.code)

    expect(set.coverUrl).toBe(alvo.coverUrl)
    expect(set.kind).toBe(alvo.kind)
  })

  /** A capa e URL da origem; nada de imagem no nosso banco (decisao 020). */
  it('a capa e uma URL da origem', async () => {
    const sets = await listSets(testPrisma())

    for (const set of sets) {
      if (set.coverUrl) expect(set.coverUrl).toMatch(/^https:\/\/en\.onepiece-cardgame\.com\//)
    }
  })
})

describe('ordem da listagem', () => {
  /**
   * As paginas nao podem repetir nem pular. O risco concreto: a pagina e
   * hidratada com `IN (...)`, que **nao** preserva a ordem da lista de ids —
   * sem reordenar depois, uma carta apareceria duas vezes e outra sumiria.
   */
  it('percorrer as paginas devolve cada variante uma vez', async () => {
    const inteiro = await searchCatalog(testPrisma(), { pageSize: 100 })

    const porPagina: string[] = []
    // O total de paginas depende do tamanho pedido, e `inteiro` veio com 100.
    const paginas = Math.ceil(inteiro.total / 2)
    for (let page = 1; page <= paginas; page++) {
      const pagina = await searchCatalog(testPrisma(), { pageSize: 2, page })
      porPagina.push(...pagina.items.map((item) => String(item.variantId)))
    }

    const esperado = inteiro.items.map((item) => String(item.variantId))
    expect(porPagina).toEqual(esperado)
    expect(new Set(porPagina).size).toBe(porPagina.length)
  })

  it('a ordem nao muda entre consultas iguais', async () => {
    const primeira = await searchCatalog(testPrisma(), { pageSize: 100 })
    const segunda = await searchCatalog(testPrisma(), { pageSize: 100 })

    expect(primeira.items.map((i) => String(i.variantId))).toEqual(
      segunda.items.map((i) => String(i.variantId)),
    )
  })

  /**
   * As promos ficam por ultimo. Elas sao versoes alternativas de cartas que ja
   * apareceram antes; espalhadas no meio, a mesma carta reaparece sem
   * explicacao.
   */
  it('coloca as promocionais depois de tudo', async () => {
    const todas = await searchCatalog(testPrisma(), { pageSize: 100 })

    const setDe = new Map<string, string | null>()
    for (const item of todas.items) {
      const printing = await testPrisma().variantPrinting.findFirst({
        where: { cardVariantId: BigInt(item.variantId) },
        select: { set: { select: { code: true } } },
      })
      setDe.set(String(item.variantId), printing?.set.code ?? null)
    }

    const posicoes = todas.items.map((item) => setDe.get(String(item.variantId)))
    const primeiraPromo = posicoes.findIndex((code) => code === 'PROMO')
    if (primeiraPromo === -1) return

    // Depois da primeira promo, so pode haver promo ou variante sem set.
    for (const code of posicoes.slice(primeiraPromo)) {
      expect(code === 'PROMO' || code === null).toBe(true)
    }
  })

  it('o total conta o filtro inteiro, nao a pagina', async () => {
    const pagina = await searchCatalog(testPrisma(), { pageSize: 2 })
    const inteiro = await searchCatalog(testPrisma(), { pageSize: 100 })

    expect(pagina.total).toBe(inteiro.total)
    expect(pagina.items.length).toBeLessThanOrEqual(2)
  })

  it('pagina alem do fim devolve vazio, e nao erro', async () => {
    const resultado = await searchCatalog(testPrisma(), { pageSize: 10, page: 999 })

    expect(resultado.items).toEqual([])
    expect(resultado.total).toBeGreaterThan(0)
  })
})

describe('capa do set', () => {
  const semPontuacao = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '')

  /**
   * A capa vinha de outro set em 40 dos 60: "a primeira carta por codigo" trazia
   * a mais antiga, e um set com reimpressao se apresentava com carta alheia.
   */
  it('vem de uma carta do proprio set', async () => {
    const sets = await listSets(testPrisma())

    for (const set of sets) {
      if (!set.coverUrl) continue

      const arquivo = set.coverUrl.split('/').pop()?.replace(/\.[a-z]+$/, '') ?? ''
      const prefixo = semPontuacao(arquivo.split('-')[0] ?? '')

      // PROMO e coletaneas avulsas nao tem carta de codigo proprio; ali o
      // recuo para qualquer carta do set e o comportamento correto.
      const temCodigoProprio = await testPrisma().cardVariant.count({
        where: {
          printings: { some: { set: { code: set.code } } },
          card: { code: { startsWith: set.code.replace('-', '') } },
        },
      })
      if (temCodigoProprio === 0) continue

      expect(semPontuacao(set.code), `capa de ${set.code}`).toContain(prefixo)
    }
  })

  /** O Leader e a face do set: e a carta que estampa o produto. */
  it('prefere o Leader do set quando existe', async () => {
    const sets = await listSets(testPrisma())

    for (const set of sets) {
      const leaders = await testPrisma().cardVariant.count({
        where: {
          printings: { some: { set: { code: set.code } } },
          card: { type: 'Leader' },
          imageUrl: { not: null },
        },
      })
      if (leaders === 0 || !set.coverUrl) continue

      const escolhida = await testPrisma().cardVariant.findFirst({
        where: { imageUrl: set.coverUrl, printings: { some: { set: { code: set.code } } } },
        select: { card: { select: { type: true } } },
      })
      expect(escolhida?.card.type, `capa de ${set.code}`).toBe('Leader')
    }
  })

  it('expoe o codigo normalizado junto com o original', async () => {
    const sets = await listSets(testPrisma())

    for (const set of sets) {
      expect(set.code).toBeTruthy()
      expect(set.displayCode).not.toMatch(/^[A-Za-z]+-\d+$/)
    }
  })
})
