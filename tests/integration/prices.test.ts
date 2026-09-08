import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { importPrices } from '@/server/application/prices/import-prices'
import { getMarketPrice } from '@/server/application/prices/read-prices'
import type { KnownCardNames, PriceProvider, SourcePrice } from '@/server/http/price-provider'
import { createVariant, disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * A importacao de precos contra o banco de verdade.
 *
 * A escolha de qual produto e a arte comum esta em
 * `tests/domain/price-matching.test.ts`, sem rede. Aqui se verifica o que so o
 * banco pode dizer: que a paralela nao ganha o preco da comum, que a serie
 * historica nao e sobrescrita, e que rodar duas vezes no mesmo dia nao inventa
 * linha nova.
 */

const silent = { info: () => {}, warn: () => {} }

/** Fonte falsa: sem rede, e guarda o que recebeu para o teste conferir. */
function fakeProvider(prices: SourcePrice[]) {
  const recebido: KnownCardNames[] = []

  const provider: PriceProvider = {
    name: 'falsa',
    fetchCommonArtPrices: async (knownNames) => {
      recebido.push(knownNames)
      return prices
    },
  }

  return { provider, recebido }
}

const usd = (cardCode: string, value: number): SourcePrice => ({
  cardCode,
  value,
  currency: 'USD',
})

async function carta(code: string, name = 'Carta de teste') {
  const db = testPrisma()
  const card = await db.card.create({ data: { code, name, type: 'Character' } })
  const normal = await createVariant(card.id, 'Normal')
  return { card, normal }
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('importacao de precos', () => {
  it('grava o preco na variante Normal da carta de mesmo codigo', async () => {
    const { normal } = await carta('OP01-001')
    const { provider } = fakeProvider([usd('OP01-001', 12.34)])

    const resultado = await importPrices(testPrisma(), provider, { logger: silent })

    expect(resultado).toMatchObject({ fetched: 1, matched: 1, written: 1, unknownCodes: 0 })
    expect(await getMarketPrice(testPrisma(), normal.id)).toMatchObject({
      value: 12.34,
      currency: 'USD',
    })
  })

  /**
   * O codigo identifica a carta, nao a arte: a paralela e outra impressao, com
   * outro preco. Mostrar o da comum ali seria inventar numero num campo de
   * dinheiro (decisao 050).
   */
  it('nao da preco a paralela', async () => {
    const { card } = await carta('OP01-002')
    const paralela = await createVariant(card.id, 'Parallel')
    const { provider } = fakeProvider([usd('OP01-002', 40)])

    await importPrices(testPrisma(), provider, { logger: silent })

    expect(await getMarketPrice(testPrisma(), paralela.id)).toBeNull()
  })

  it('conta o codigo que a fonte tem e o nosso catalogo nao', async () => {
    await carta('OP01-003')
    const { provider } = fakeProvider([usd('OP01-003', 1), usd('OP99-999', 2)])

    const resultado = await importPrices(testPrisma(), provider, { logger: silent })

    expect(resultado).toMatchObject({ fetched: 2, matched: 1, unknownCodes: 1 })
    expect(await testPrisma().cardPrice.count()).toBe(1)
  })

  it('casa o codigo sem depender da caixa', async () => {
    const { normal } = await carta('OP01-004')
    const { provider } = fakeProvider([usd('op01-004', 3.5)])

    await importPrices(testPrisma(), provider, { logger: silent })

    expect(await getMarketPrice(testPrisma(), normal.id)).toMatchObject({ value: 3.5 })
  })
})

describe('a serie so cresce quando o preco muda', () => {
  /**
   * Gravar toda captura diaria de todas as variantes daria mais de um milhao de
   * linhas por ano para uma serie que quase nao muda.
   */
  it('nao grava nada na segunda passada com o mesmo valor', async () => {
    await carta('OP01-005')
    const { provider } = fakeProvider([usd('OP01-005', 7.5)])
    const db = testPrisma()

    await importPrices(db, provider, { logger: silent })
    const segunda = await importPrices(db, provider, { logger: silent })

    expect(segunda).toMatchObject({ matched: 1, written: 0, unchanged: 1 })
    expect(await db.cardPrice.count()).toBe(1)
  })

  /**
   * A coluna e `numeric(12,2)` e o valor volta como ponto flutuante: comparar
   * direto faria 12.34 diferir de si mesmo e cada importacao regravaria tudo.
   */
  it('reconhece o mesmo valor depois da ida e volta ao banco', async () => {
    await carta('OP01-006')
    const { provider } = fakeProvider([usd('OP01-006', 0.1 + 0.2)])
    const db = testPrisma()

    await importPrices(db, provider, { logger: silent })
    const segunda = await importPrices(db, provider, { logger: silent })

    expect(segunda).toMatchObject({ written: 0, unchanged: 1 })
  })

  it('acrescenta linha quando o valor muda, sem apagar a anterior', async () => {
    const { normal } = await carta('OP01-007')
    const db = testPrisma()
    const ontem = new Date('2026-09-05T12:00:00Z')
    const hoje = new Date('2026-09-06T12:00:00Z')

    await importPrices(db, fakeProvider([usd('OP01-007', 5)]).provider, {
      logger: silent,
      capturedAt: ontem,
    })
    await importPrices(db, fakeProvider([usd('OP01-007', 9)]).provider, {
      logger: silent,
      capturedAt: hoje,
    })

    expect(await db.cardPrice.count()).toBe(2)
    expect(await getMarketPrice(db, normal.id)).toMatchObject({ value: 9, since: hoje })
  })

  /** Cair de preco e mudanca como qualquer outra. */
  it('grava a queda de preco', async () => {
    const { normal } = await carta('OP01-008')
    const db = testPrisma()

    await importPrices(db, fakeProvider([usd('OP01-008', 20)]).provider, {
      logger: silent,
      capturedAt: new Date('2026-09-05T12:00:00Z'),
    })
    await importPrices(db, fakeProvider([usd('OP01-008', 3.75)]).provider, {
      logger: silent,
      capturedAt: new Date('2026-09-06T12:00:00Z'),
    })

    expect(await getMarketPrice(db, normal.id)).toMatchObject({ value: 3.75 })
  })
})

describe('o catalogo que a fonte recebe', () => {
  /**
   * A fonte precisa dos nossos nomes para desempatar cartas cujo nome tem
   * parenteses de verdade — `Mr.1(Daz.Bonez)`. Sem isso elas ficam sem preco.
   */
  it('manda codigo em maiusculas e o nome de cada carta', async () => {
    await carta('op01-083', 'Mr.1(Daz.Bonez)')
    const { provider, recebido } = fakeProvider([])

    await importPrices(testPrisma(), provider, { logger: silent })

    expect(recebido).toHaveLength(1)
    expect(recebido[0].get('OP01-083')).toBe('Mr.1(Daz.Bonez)')
  })
})

describe('leitura do preco vigente', () => {
  it('devolve nulo quando a variante nunca teve preco', async () => {
    const { normal } = await carta('OP01-009')

    expect(await getMarketPrice(testPrisma(), normal.id)).toBeNull()
  })

  /**
   * `since` e a data da ultima **mudanca**, nao da ultima conferida: a serie e
   * esparsa, entao nao ha como distinguir "nao mudou" de "nao foi verificado".
   * A tela diz "desde", e nao "atualizado em", por causa disto.
   */
  it('devolve a data em que o valor passou a valer', async () => {
    const { normal } = await carta('OP01-010')
    const quando = new Date('2026-09-01T00:00:00Z')

    await importPrices(testPrisma(), fakeProvider([usd('OP01-010', 2)]).provider, {
      logger: silent,
      capturedAt: quando,
    })

    expect(await getMarketPrice(testPrisma(), normal.id)).toEqual({
      value: 2,
      since: quando,
      currency: 'USD',
    })
  })
})
