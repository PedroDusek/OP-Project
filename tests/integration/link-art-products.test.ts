import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { linkArtProducts } from '@/server/application/prices/link-art-products'
import { importPrices } from '@/server/application/prices/import-prices'
import { getMarketPrice } from '@/server/application/prices/read-prices'
import type {
  PriceProvider,
  SourceArtProduct,
  SourceCommonArt,
  SourcePrice,
} from '@/server/http/price-provider'
import { createVariant, disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * O vinculo entre a nossa arte e o produto da fonte.
 *
 * O codigo da carta identifica a carta, nao a arte, e o nosso catalogo so
 * separa Normal de Parallel (decisao 023). Sem este vinculo, paralela nao tem
 * preco.
 *
 * O que se protege aqui, acima de tudo: **vinculo manual nunca e sobrescrito**.
 * Ele custou o tempo do dono do produto, e uma rederivacao que o apagasse
 * tornaria o mapeamento manual impossivel de confiar.
 */

const silent = { info: () => {}, warn: () => {} }

function fonte(
  arts: SourceArtProduct[],
  prices: SourcePrice[] = [],
  commonArts: SourceCommonArt[] = [],
): PriceProvider {
  return {
    name: 'falsa',
    fetchSnapshot: async () => ({ prices, arts, commonArts, sourceUpdatedAt: null }),
  }
}

const arte = (
  cardCode: string,
  productId: string,
  label: string,
  value: number | null = null,
): SourceArtProduct => ({ cardCode, productId, label, value })

/** Uma carta com uma arte comum e quantas paralelas o teste pedir. */
async function carta(code: string, paralelas: number) {
  const db = testPrisma()
  const card = await db.card.create({ data: { code, name: 'Carta', type: 'Character' } })
  const normal = await createVariant(card.id, 'Normal')
  const parallels = []
  for (let i = 0; i < paralelas; i++) parallels.push(await createVariant(card.id, 'Parallel'))
  return { card, normal, parallels }
}

async function vinculos() {
  return testPrisma().variantSourceProduct.findMany({
    select: { cardVariantId: true, sourceProductId: true, origin: true },
  })
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('o caso sem escolha', () => {
  it('vincula quando ha uma arte de cada lado', async () => {
    const { parallels } = await carta('OP01-001', 1)

    const resultado = await linkArtProducts(
      testPrisma(),
      fonte([arte('OP01-001', '712001', 'Alternate Art')]),
      { logger: silent },
    )

    expect(resultado).toMatchObject({ cards: 1, created: 1, ambiguous: 0 })
    expect(await vinculos()).toEqual([
      { cardVariantId: parallels[0].id, sourceProductId: '712001', origin: 'automatic' },
    ])
  })

  /**
   * Com duas de cada lado, casar exige saber qual e a Alternate Art e qual e a
   * Manga. Isso e olho humano, e chutar poria preco de uma arte na outra.
   */
  it('nao vincula quando ha duas artes de cada lado', async () => {
    await carta('OP01-002', 2)

    const resultado = await linkArtProducts(
      testPrisma(),
      fonte([
        arte('OP01-002', '712002', 'Alternate Art'),
        arte('OP01-002', '712003', 'Manga'),
      ]),
      { logger: silent },
    )

    expect(resultado).toMatchObject({ ambiguous: 1, created: 0 })
    expect(await vinculos()).toEqual([])
  })

  it('nao vincula quando as contagens divergem', async () => {
    await carta('OP01-003', 2)

    const resultado = await linkArtProducts(
      testPrisma(),
      fonte([arte('OP01-003', '712004', 'Alternate Art')]),
      { logger: silent },
    )

    expect(resultado).toMatchObject({ ambiguous: 1, created: 0 })
  })

  it('conta a carta cuja arte a fonte nao oferece', async () => {
    await carta('OP01-004', 1)

    const resultado = await linkArtProducts(testPrisma(), fonte([]), { logger: silent })

    expect(resultado).toMatchObject({ withoutSource: 1, created: 0 })
  })

  it('ignora a arte comum: ela nao precisa de vinculo', async () => {
    const { normal } = await carta('OP01-005', 1)

    await linkArtProducts(
      testPrisma(),
      fonte([arte('OP01-005', '712005', 'Alternate Art')]),
      { logger: silent },
    )

    const ids = (await vinculos()).map((v) => v.cardVariantId)
    expect(ids).not.toContain(normal.id)
  })
})

describe('rodar de novo', () => {
  it('nao recria o que ja existe', async () => {
    await carta('OP01-010', 1)
    const provider = fonte([arte('OP01-010', '712010', 'Alternate Art')])

    await linkArtProducts(testPrisma(), provider, { logger: silent })
    const segunda = await linkArtProducts(testPrisma(), provider, { logger: silent })

    expect(segunda).toMatchObject({ created: 0, unchanged: 1 })
    expect(await vinculos()).toHaveLength(1)
  })

  /** Vinculo automatico sai de regra: se a fonte mudar, a regra corrige. */
  it('corrige o automatico quando a fonte troca o produto', async () => {
    await carta('OP01-011', 1)

    await linkArtProducts(
      testPrisma(),
      fonte([arte('OP01-011', '712011', 'Alternate Art')]),
      { logger: silent },
    )
    const segunda = await linkArtProducts(
      testPrisma(),
      fonte([arte('OP01-011', '999999', 'Alternate Art')]),
      { logger: silent },
    )

    expect(segunda).toMatchObject({ updated: 1 })
    expect((await vinculos())[0].sourceProductId).toBe('999999')
  })
})

describe('o vinculo manual e intocavel', () => {
  /**
   * O ponto que torna o mapeamento manual sustentavel. Sem isto, a primeira
   * rederivacao apagaria horas de trabalho do dono do produto.
   */
  it('nao sobrescreve o manual nem quando a fonte discorda', async () => {
    const { parallels } = await carta('OP01-020', 1)
    await testPrisma().variantSourceProduct.create({
      data: {
        cardVariantId: parallels[0].id,
        source: 'falsa',
        sourceProductId: 'escolhido-a-mao',
        origin: 'manual',
      },
    })

    const resultado = await linkArtProducts(
      testPrisma(),
      fonte([arte('OP01-020', '712020', 'Alternate Art')]),
      { logger: silent },
    )

    expect(resultado).toMatchObject({ manualKept: 1, created: 0, updated: 0 })
    expect((await vinculos())[0]).toMatchObject({
      sourceProductId: 'escolhido-a-mao',
      origin: 'manual',
    })
  })
})

describe('o preco chega na arte vinculada', () => {
  it('grava o preco da paralela pelo vinculo', async () => {
    const { parallels } = await carta('OP01-030', 1)
    const provider = fonte([arte('OP01-030', '712030', 'Alternate Art', 42.5)])

    await linkArtProducts(testPrisma(), provider, { logger: silent })
    const resultado = await importPrices(testPrisma(), provider, { logger: silent })

    expect(resultado.linkedPriced).toBe(1)
    expect(await getMarketPrice(testPrisma(), parallels[0].id)).toMatchObject({ value: 42.5 })
  })

  /** Sem vinculo nao ha preco: o codigo sozinho nao diz qual arte e qual. */
  it('nao grava nada na paralela sem vinculo', async () => {
    const { parallels } = await carta('OP01-031', 1)

    const resultado = await importPrices(
      testPrisma(),
      fonte([arte('OP01-031', '712031', 'Alternate Art', 42.5)]),
      { logger: silent },
    )

    expect(resultado.linkedPriced).toBe(0)
    expect(await getMarketPrice(testPrisma(), parallels[0].id)).toBeNull()
  })

  it('ignora a arte vinculada que a fonte nao cota', async () => {
    const { parallels } = await carta('OP01-032', 1)
    const provider = fonte([arte('OP01-032', '712032', 'Alternate Art', null)])

    await linkArtProducts(testPrisma(), provider, { logger: silent })
    await importPrices(testPrisma(), provider, { logger: silent })

    expect(await getMarketPrice(testPrisma(), parallels[0].id)).toBeNull()
  })

  it('nao regrava o preco da paralela que nao mudou', async () => {
    await carta('OP01-033', 1)
    const provider = fonte([arte('OP01-033', '712033', 'Alternate Art', 9.9)])

    await linkArtProducts(testPrisma(), provider, { logger: silent })
    await importPrices(testPrisma(), provider, { logger: silent })
    const segunda = await importPrices(testPrisma(), provider, { logger: silent })

    expect(segunda).toMatchObject({ written: 0, unchanged: 1 })
  })
})
