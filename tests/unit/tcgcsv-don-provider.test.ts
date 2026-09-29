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
      // Mais cinco, para a fracao de imagens que falham ser mensuravel: a trava
      // do provedor so opina quando ha amostra.
      ...[1, 2, 3, 4, 5].map((n) => ({
        productId: 500000 + n,
        name: `DON!! Card (${n})`,
        imageUrl: `https://tcgplayer-cdn.tcgplayer.com/product/${500000 + n}_200w.jpg`,
        extendedData: [{ name: 'CardType', value: 'DON!!' }],
      })),
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

/** As imagens que o CDN "tem". O que nao estiver aqui responde 403, como no real. */
const TODAS = ['482236', '500001', '500002', '500003', '500004', '500005']
let imagensQueExistem = new Set<string>(TODAS)

function provider() {
  const fetchImpl = vi.fn(async (url: string | URL, _init?: RequestInit) => {
    const texto = String(url)

    if (_init?.method === 'HEAD') {
      const id = /\/product\/(\d+)_/.exec(texto)?.[1] ?? ''
      return new Response(null, { status: imagensQueExistem.has(id) ? 200 : 403 })
    }

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

    expect(page.cards).toHaveLength(6)
    expect(page.cards[0]).toMatchObject({ code: 'DON-482236', name: 'DON!! Card (Luffy)', type: 'DON' })
    expect(page.cards.some((c) => c.name === 'Monkey.D.Luffy')).toBe(false)
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
    imagensQueExistem = new Set(TODAS)
    const { provider: p } = provider()
    const [arte] = (await p.fetchSeries('1')).variants

    expect(arte.imageUrl).toBe('https://tcgplayer-cdn.tcgplayer.com/product/482236_200w.jpg')
  })

  /*
   * O TCGplayer publica a URL mesmo sem ter o arquivo, e ela devolve 403.
   * Guardada, vira icone quebrado na tela — `CardArt` ja mostra o codigo quando
   * nao ha imagem, so precisa que o campo venha nulo. 4 das 239 em 24/09.
   */
  it('descarta a imagem que nao responde', async () => {
    // Uma de seis: abaixo do teto, entao a falha e da imagem.
    imagensQueExistem = new Set(TODAS.filter((id) => id !== '482236'))
    const { provider: p } = provider()
    const page = await p.fetchSeries('1')

    const quebrada = page.variants.find((v) => v.sourceId === '482236')!
    const boa = page.variants.find((v) => v.sourceId === '500001')!
    expect(quebrada.imageUrl).toBeNull()
    expect(boa.imageUrl).toContain('500001_200w.jpg')
  })

  /*
   * 403 e tambem o que um limitador de trafego devolve. Se muitas falharem de
   * uma vez, e mais provavel que sejamos nos sendo barrados do que as imagens
   * terem sumido — e apagar todas estragaria o catalogo por causa de uma
   * resposta nossa.
   */
  it('quando quase tudo falha, nao descarta nada', async () => {
    imagensQueExistem = new Set()
    const { provider: p } = provider()
    const page = await p.fetchSeries('1')

    expect(page.variants.every((v) => v.imageUrl !== null)).toBe(true)
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
