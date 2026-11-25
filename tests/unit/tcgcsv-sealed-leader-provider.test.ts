import { describe, expect, it, vi } from 'vitest'
import { TcgCsvSealedLeaderProvider } from '@/server/infrastructure/catalog/tcgcsv-sealed-leader-provider'

/**
 * O provedor dos líderes de evento selado (decisão 115).
 *
 * `fetch` injetado: o que interessa é a tradução do payload do tcgcsv para o
 * nosso formato, e ela precisa ser verificável sem rede.
 *
 * O payload abaixo é o do produto real, copiado da fonte em 25/11 — inclusive o
 * ponto e vírgula que separa as cores e a ausência do campo `Number`, que é
 * justamente o motivo de esta carta precisar de um código nosso.
 */

const LUFFY = {
  productId: 712746,
  name: 'Monkey.D.Luffy (4th Anniversary Leader Card)',
  imageUrl: 'https://tcgplayer-cdn.tcgplayer.com/product/712746_200w.jpg',
  extendedData: [
    { name: 'Rarity', value: 'L' },
    { name: 'Color', value: 'Blue;Green;Purple;Red;Black;Yellow' },
    { name: 'CardType', value: 'Leader' },
    { name: 'Life', value: '5' },
    { name: 'Power', value: '5000' },
    { name: 'Subtypes', value: 'Straw Hat Crew' },
    { name: 'Attribute', value: 'Strike' },
  ],
}

/** Uma carta qualquer do mesmo grupo, que não está na lista escolhida. */
const OUTRA = {
  productId: 518694,
  name: 'Monkey.D.Luffy (047) (Sealed Battle Kit Vol. 1)',
  imageUrl: 'https://tcgplayer-cdn.tcgplayer.com/product/518694_200w.jpg',
  extendedData: [
    { name: 'Number', value: 'P-047' },
    { name: 'Color', value: 'Blue' },
    { name: 'CardType', value: 'Leader' },
  ],
}

function provider(produtos: unknown[] = [LUFFY, OUTRA], productIds?: number[]) {
  const fetchImpl = vi.fn(async (_url: string | URL, _init?: RequestInit) =>
    new Response(JSON.stringify({ results: produtos }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )

  return {
    provider: new TcgCsvSealedLeaderProvider({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      productIds,
    }),
    fetchImpl,
  }
}

describe('a série', () => {
  it('é uma só: são poucos produtos escolhidos a dedo', async () => {
    const { provider: p } = provider()
    expect(await p.listSeriesIds()).toEqual(['lideres-selados'])
  })

  it('recusa uma série que não é a dela', async () => {
    const { provider: p } = provider()
    await expect(p.fetchSeries('outra')).rejects.toThrow(/serie desconhecida/)
  })
})

describe('a tradução do payload', () => {
  it('traz a carta com as seis cores', async () => {
    const { provider: p } = provider()
    const page = await p.fetchSeries('lideres-selados')

    expect(page.cards).toHaveLength(1)
    expect(page.cards[0]).toMatchObject({
      code: 'SB-712746',
      name: 'Monkey.D.Luffy (4th Anniversary Leader Card)',
      type: 'Leader',
      life: 5,
      power: 5000,
    })
    expect(page.cards[0].colors).toEqual(['Blue', 'Green', 'Purple', 'Red', 'Black', 'Yellow'])
    expect(page.cards[0].traits).toEqual(['Straw Hat Crew'])
    expect(page.cards[0].attributes).toEqual(['Strike'])
  })

  /**
   * `null` é "não se aplica", e não zero (armadilha 87). Leader não tem custo
   * nem counter, e com zero ele entraria nas faixas de custo do filtro.
   */
  it('custo e counter são nulos, e não zero', async () => {
    const { provider: p } = provider()
    const page = await p.fetchSeries('lideres-selados')

    expect(page.cards[0].cost).toBeNull()
    expect(page.cards[0].counter).toBeNull()
  })

  it('a arte traz o productId como source_id, e mora no PROMO', async () => {
    const { provider: p } = provider()
    const page = await p.fetchSeries('lideres-selados')

    expect(page.variants).toHaveLength(1)
    expect(page.variants[0]).toMatchObject({
      sourceId: '712746',
      cardCode: 'SB-712746',
      variantType: 'Normal',
      rarity: 'L',
      imageUrl: 'https://tcgplayer-cdn.tcgplayer.com/product/712746_200w.jpg',
      printedInSetCodes: ['PROMO'],
    })
    expect(page.sets).toEqual([{ code: 'PROMO', name: 'One Piece Promotion Cards' }])
  })

  /*
   * O grupo tem 1.552 produtos, e tres outros lideres de seis cores. A escolha
   * e nominal (decisao 115): uma regra que pescasse "todo lider de seis cores"
   * traria sozinha o proximo que a fonte publicasse.
   */
  it('traz só os produtos escolhidos, e ignora o resto do grupo', async () => {
    const { provider: p } = provider()
    const page = await p.fetchSeries('lideres-selados')

    expect(page.cards.map((carta) => carta.code)).toEqual(['SB-712746'])
  })

  it('o nome vai para o relatório, como a decisão 024 pede do set PROMO', async () => {
    const { provider: p } = provider()
    const page = await p.fetchSeries('lideres-selados')

    expect(page.promotionalProductNames).toEqual([
      'Monkey.D.Luffy (4th Anniversary Leader Card)',
    ])
  })
})

/**
 * Produto que sai de catálogo vira recusa anotada, e não exceção: a nossa lista
 * e o espelho do TCGplayer mudam em ritmos diferentes, e derrubar a importação
 * por um id que sumiu custaria mais que registrar.
 */
describe('o produto que a fonte não tem', () => {
  it('é recusado com motivo, sem derrubar a importação', async () => {
    const { provider: p } = provider([OUTRA], [712746])
    const page = await p.fetchSeries('lideres-selados')

    expect(page.cards).toEqual([])
    expect(page.rejected).toEqual([
      { sourceId: '712746', reason: 'produto nao encontrado no grupo de promocoes' },
    ])
  })
})

describe('a identificação com a fonte', () => {
  /* Sem `User-Agent` o tcgcsv responde em texto que não é JSON (armadilha 95). */
  it('manda o nosso User-Agent', async () => {
    const { provider: p, fetchImpl } = provider()
    await p.fetchSeries('lideres-selados')

    const init = fetchImpl.mock.calls[0][1]
    const headers = init?.headers as Record<string, string>
    expect(headers['user-agent']).toContain('ColeXa')
  })
})
