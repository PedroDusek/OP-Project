import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { importPrices } from '@/server/application/prices/import-prices'
import { importExchangeRate } from '@/server/application/prices/import-exchange-rate'
import {
  getMarketPrice,
  getPriceFreshness,
  getUsdBrlRate,
} from '@/server/application/prices/read-prices'
import type { ExchangeRateProvider } from '@/server/http/exchange-rate-provider'
import type {
  KnownCardNames,
  PriceProvider,
  SourceArtProduct,
  SourceCommonArt,
  SourcePrice,
} from '@/server/http/price-provider'
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
function fakeProvider(
  prices: SourcePrice[],
  sourceUpdatedAt: Date | null = null,
  arts: SourceArtProduct[] = [],
  commonArts: SourceCommonArt[] = [],
) {
  const recebido: KnownCardNames[] = []

  const provider: PriceProvider = {
    name: 'falsa',
    fetchSnapshot: async (knownNames) => {
      recebido.push(knownNames)
      return { prices, arts, commonArts, sourceUpdatedAt }
    },
  }

  return { provider, recebido }
}

/** Fonte que quebra, para exercer o registro da falha. */
function brokenProvider(message: string): PriceProvider {
  return {
    name: 'falsa',
    fetchSnapshot: async () => {
      throw new Error(message)
    },
  }
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
      brl: null,
    })
  })
})


/** Fonte de cambio falsa: sem rede, com a data que o teste quiser. */
function fakeRates(rates: { rate: number; quoteDate: Date }[]): ExchangeRateProvider {
  let call = 0
  return {
    name: 'falsa',
    fetchLatestUsdBrl: async () => {
      const next = rates[Math.min(call++, rates.length - 1)]
      if (!next) return null
      return { base: 'USD', quote: 'BRL', ...next }
    },
  }
}

const semCambio: ExchangeRateProvider = {
  name: 'falsa',
  fetchLatestUsdBrl: async () => null,
}

describe('cotacao do dolar', () => {
  const dia = new Date('2026-09-08T00:00:00Z')

  it('grava a cotacao do dia', async () => {
    const db = testPrisma()

    const resultado = await importExchangeRate(db, fakeRates([{ rate: 5.1253, quoteDate: dia }]), {
      logger: silent,
    })

    expect(resultado).toMatchObject({ rate: 5.1253, unchanged: false })
    expect(await getUsdBrlRate(db, new Date('2026-09-08T12:00:00Z'))).toMatchObject({
      rate: 5.1253,
    })
  })

  /**
   * Uma linha por par por dia. Sem isso, "a cotacao de hoje" dependeria de qual
   * linha a consulta escolhesse — e no fim de semana seriam tres dias gravando
   * a mesma sexta.
   */
  it('nao duplica ao rodar duas vezes no mesmo dia', async () => {
    const db = testPrisma()
    const fonte = fakeRates([{ rate: 5.1253, quoteDate: dia }])

    await importExchangeRate(db, fonte, { logger: silent })
    const segunda = await importExchangeRate(db, fonte, { logger: silent })

    expect(segunda).toMatchObject({ unchanged: true })
    expect(await db.exchangeRate.count()).toBe(1)
  })

  /** O Banco Central corrige cotacao publicada, e a correcao tem de valer. */
  it('sobrescreve o valor do mesmo dia quando ele muda', async () => {
    const db = testPrisma()

    await importExchangeRate(db, fakeRates([{ rate: 5.1253, quoteDate: dia }]), { logger: silent })
    await importExchangeRate(db, fakeRates([{ rate: 5.2, quoteDate: dia }]), { logger: silent })

    expect(await db.exchangeRate.count()).toBe(1)
    expect(await getUsdBrlRate(db, new Date('2026-09-08T12:00:00Z'))).toMatchObject({ rate: 5.2 })
  })

  it('devolve nulo quando a fonte nao tem cotacao', async () => {
    const resultado = await importExchangeRate(testPrisma(), semCambio, { logger: silent })

    expect(resultado).toBeNull()
    expect(await testPrisma().exchangeRate.count()).toBe(0)
  })

  /** Converter por taxa velha seria apresentar palpite com cara de dado. */
  it('esconde a cotacao velha demais', async () => {
    const db = testPrisma()
    await importExchangeRate(db, fakeRates([{ rate: 5.1253, quoteDate: dia }]), { logger: silent })

    // Tres dias ainda valem: cobrem o fim de semana com feriado emendado.
    expect(await getUsdBrlRate(db, new Date('2026-09-11T12:00:00Z'))).not.toBeNull()
    expect(await getUsdBrlRate(db, new Date('2026-09-12T12:00:00Z'))).toBeNull()
  })
})

describe('preco em real', () => {
  it('converte usando a cotacao vigente e diz qual foi', async () => {
    const db = testPrisma()
    const { normal } = await carta('OP01-020')

    await importPrices(db, fakeProvider([usd('OP01-020', 12.34)]).provider, { logger: silent })
    await importExchangeRate(
      db,
      fakeRates([{ rate: 5.1253, quoteDate: new Date('2026-09-08T00:00:00Z') }]),
      { logger: silent },
    )

    const preco = await getMarketPrice(db, normal.id, new Date('2026-09-08T12:00:00Z'))

    expect(preco).toMatchObject({ value: 12.34 })
    expect(preco?.brl).toMatchObject({ value: 63.25, rate: 5.1253 })
  })

  it('deixa o real nulo quando nao ha cotacao', async () => {
    const db = testPrisma()
    const { normal } = await carta('OP01-021')

    await importPrices(db, fakeProvider([usd('OP01-021', 12.34)]).provider, { logger: silent })

    expect((await getMarketPrice(db, normal.id))?.brl).toBeNull()
  })
})

describe('registro de cada importacao', () => {
  /**
   * card_prices so ganha linha quando o valor muda, entao sem este registro nao
   * ha como a tela dizer "conferido hoje as 04:00".
   */
  it('grava quando rodou, e o que aconteceu', async () => {
    const db = testPrisma()
    await carta('OP01-030')
    const publicado = new Date('2026-09-08T20:06:11Z')

    await importPrices(db, fakeProvider([usd('OP01-030', 1)], publicado).provider, {
      logger: silent,
    })

    const frescor = await getPriceFreshness(db)
    expect(frescor?.sourceUpdatedAt).toEqual(publicado)
    expect(frescor?.checkedAt).toBeInstanceOf(Date)
  })

  it('guarda os numeros da passada', async () => {
    const db = testPrisma()
    await carta('OP01-031')

    await importPrices(db, fakeProvider([usd('OP01-031', 1), usd('OP99-999', 2)]).provider, {
      logger: silent,
    })

    expect(await db.priceImport.findFirst()).toMatchObject({
      source: 'falsa',
      fetched: 2,
      matched: 1,
      written: 1,
      unknownCodes: 1,
    })
  })

  /**
   * Importacao que quebrou nao conferiu nada. Conta-la faria a tela dizer
   * "atualizado hoje" justamente no dia em que a importacao parou — que e
   * quando o aviso mais precisa ser verdade.
   */
  it('nao conta como conferida a importacao que falhou', async () => {
    const db = testPrisma()

    await expect(
      importPrices(db, brokenProvider('fonte fora do ar'), { logger: silent }),
    ).rejects.toThrow('fonte fora do ar')

    expect(await getPriceFreshness(db)).toBeNull()
    expect(await db.priceImport.findFirst()).toMatchObject({ failure: 'fonte fora do ar' })
  })

  it('devolve a ultima que terminou bem, e nao a mais recente', async () => {
    const db = testPrisma()
    await carta('OP01-032')

    await importPrices(db, fakeProvider([usd('OP01-032', 1)]).provider, { logger: silent })
    await expect(
      importPrices(db, brokenProvider('caiu depois'), { logger: silent }),
    ).rejects.toThrow()

    const frescor = await getPriceFreshness(db)
    expect(frescor).not.toBeNull()
  })

  it('devolve nulo antes da primeira importacao', async () => {
    expect(await getPriceFreshness(testPrisma())).toBeNull()
  })
})
