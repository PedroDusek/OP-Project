import { describe, expect, it, vi } from 'vitest'
import { TcgCsvDonProvider } from '@/server/infrastructure/catalog/tcgcsv-don-provider'

/**
 * O provedor dos DON!! (decisão 112).
 *
 * `fetch` injetado: a tradução do payload do tcgcsv para o nosso formato é o
 * que interessa, e ela precisa ser verificável sem rede.
 */

const GRUPOS = {
  results: [
    { groupId: 1, name: 'Romance Dawn', abbreviation: 'OP01' },
    { groupId: 2, name: 'Sem DON', abbreviation: 'OP02' },
  ],
}

const PRODUTOS: Record<string, unknown> = {
  '1': {
    results: [
      {
        productId: 482236,
        name: 'DON!! Card (Luffy)',
        imageUrl: 'https://tcgplayer-cdn.tcgplayer.com/product/482236_200w.jpg',
        extendedData: [
          { name: 'Rarity', value: 'DON!!' },
          { name: 'CardType', value: 'DON!!' },
        ],
      },
      {
        productId: 100,
        name: 'Monkey.D.Luffy',
        extendedData: [{ name: 'CardType', value: 'Leader' }],
      },
    ],
  },
  '2': {
    results: [{ productId: 200, name: 'Nami', extendedData: [{ name: 'CardType', value: 'Character' }] }],
  },
}

function provider() {
  const fetchImpl = vi.fn(async (url: string | URL, _init?: RequestInit) => {
    void _init
    const texto = String(url)
    const grupo = /\/68\/(\d+)\/products$/.exec(texto)?.[1]
    const corpo = grupo ? PRODUTOS[grupo] : GRUPOS
    return new Response(JSON.stringify(corpo), { status: 200 })
  })
  return {
    provider: new TcgCsvDonProvider({ fetchImpl: fetchImpl as unknown as typeof fetch, minIntervalMs: 0 }),
    fetchImpl,
  }
}

describe('TcgCsvDonProvider', () => {
  /* So os grupos que tem DON viram serie: cada um e uma transacao no importador. */
  it('lista apenas os grupos que tem DON', async () => {
    const { provider: p } = provider()
    expect(await p.listSeriesIds()).toEqual(['1'])
  })

  /*
   * O filtro e pelo campo `CardType`, e nao pelo nome: "DON!!" aparece em texto
   * de efeito de carta comum, e casar nome traria carta que nao e DON.
   */
  it('separa pelo CardType, e nao pelo nome', async () => {
    const { provider: p } = provider()
    const page = await p.fetchSeries('1')

    expect(page.cards).toHaveLength(1)
    expect(page.cards[0]).toMatchObject({ code: 'DON-482236', name: 'DON!! Card (Luffy)', type: 'DON' })
  })

  /*
   * DON!! nao tem custo, poder, vida nem counter. Nulo aqui e "nao se aplica", e
   * nao zero — e a distincao da armadilha 87, que e o que o mantem fora das
   * faixas de custo e poder do filtro.
   */
  it('deixa os campos numericos nulos, e nao zero', async () => {
    const { provider: p } = provider()
    const [carta] = (await p.fetchSeries('1')).cards

    expect(carta.cost).toBeNull()
    expect(carta.power).toBeNull()
    expect(carta.life).toBeNull()
    expect(carta.counter).toBeNull()
  })

  it('a arte guarda o productId', async () => {
    const { provider: p } = provider()
    const [arte] = (await p.fetchSeries('1')).variants

    expect(arte.sourceId).toBe('482236')
    expect(arte.variantType).toBe('Parallel')
    expect(arte.rarity).toBe('DON!!')
  })

  /*
   * A imagem vem do CDN do TCGplayer. O host precisa estar em `remotePatterns`,
   * senao `next/image` derruba a pagina inteira com 500 — visto ao vivo em
   * 23/09. O teste que guarda essa ponta esta em `tests/unit/next-config`.
   */
  it('guarda a imagem do TCGplayer', async () => {
    const { provider: p } = provider()
    const [arte] = (await p.fetchSeries('1')).variants

    expect(arte.imageUrl).toBe('https://tcgplayer-cdn.tcgplayer.com/product/482236_200w.jpg')
  })

  it('poe as cartas no set artificial DON', async () => {
    const { provider: p } = provider()
    const page = await p.fetchSeries('1')

    expect(page.sets).toEqual([{ code: 'DON', name: 'DON!!' }])
    expect(page.variants[0].printedInSetCodes).toEqual(['DON'])
  })

  it('recusa identificador de grupo que nao e numero', async () => {
    const { provider: p } = provider()
    await expect(p.fetchSeries('../precos')).rejects.toThrow(/invalido/)
  })

  /* O tcgcsv bloqueia quem nao se identifica, com uma resposta que nem e JSON. */
  it('se identifica no User-Agent', async () => {
    const { provider: p, fetchImpl } = provider()
    await p.fetchSeries('1')

    const [, init] = fetchImpl.mock.calls[0]
    expect((init?.headers as Record<string, string>)['user-agent']).toContain('ColeXa')
  })
})
