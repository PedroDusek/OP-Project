import { describe, expect, it, vi } from 'vitest'
import { TcgCsvPriceProvider } from '@/server/infrastructure/prices/tcgcsv-price-provider'

/**
 * O DON!! na fotografia de preços (decisão 112).
 *
 * Defeito relatado pelo dono do produto em 24/09, com preço visível na Liga e
 * no TCGplayer: as 239 cartas estavam sem preço **mesmo com os 239 vínculos
 * gravados**. A causa não era o vínculo — era antes dele. O provedor descarta
 * todo produto sem `Number`, e o DON!! não tem um, então ele nunca chegava ao
 * laço que preça pelo vínculo.
 *
 * Este teste guarda a entrada do DON!! na fotografia. Quem precificar é o caso
 * de uso; aqui basta que ele chegue lá, com valor.
 */

const GRUPOS = { results: [{ groupId: 7, name: 'Romance Dawn', abbreviation: 'OP01' }] }

const PRODUTOS = {
  results: [
    {
      productId: 900,
      name: 'Monkey.D.Luffy',
      extendedData: [
        { name: 'Number', value: 'OP01-001' },
        { name: 'CardType', value: 'Leader' },
      ],
    },
    {
      // Sem `Number`, como todo DON!! no tcgcsv.
      productId: 482236,
      name: 'DON!! Card (Luffy)',
      extendedData: [{ name: 'CardType', value: 'DON!!' }],
    },
  ],
}

const PRECOS = {
  results: [
    { productId: 900, subTypeName: 'Normal', marketPrice: 2.15 },
    { productId: 482236, subTypeName: 'Normal', marketPrice: 48.74 },
  ],
}

function provider() {
  const fetchImpl = vi.fn(async (url: string | URL) => {
    const texto = String(url)
    if (texto.endsWith('last-updated.txt')) return new Response('2026-09-24T00:00:00Z', { status: 200 })
    if (texto.endsWith('/groups')) return new Response(JSON.stringify(GRUPOS), { status: 200 })
    if (texto.endsWith('/products')) return new Response(JSON.stringify(PRODUTOS), { status: 200 })
    if (texto.endsWith('/prices')) return new Response(JSON.stringify(PRECOS), { status: 200 })
    return new Response('nao esperado', { status: 404 })
  })

  return new TcgCsvPriceProvider({
    fetchImpl: fetchImpl as unknown as typeof fetch,
    minIntervalMs: 0,
    logger: { info: () => {}, warn: () => {} },
  })
}

describe('o DON!! na fotografia de precos', () => {
  it('entra em otherProducts, com o preco de mercado', async () => {
    const snap = await provider().fetchSnapshot(new Map([['OP01-001', 'Monkey.D.Luffy']]))

    const don = snap.otherProducts.find((p) => p.productId === '482236')
    expect(don).toBeDefined()
    expect(don!.value).toBe(48.74)
  })

  /*
   * `otherProducts` e o balde de quem so recebe preco por vinculo (decisao 072),
   * e e onde o DON!! pertence: ele nao casa por numero com carta nenhuma.
   */
  it('nao entra como arte casada por numero', async () => {
    const snap = await provider().fetchSnapshot(new Map([['OP01-001', 'Monkey.D.Luffy']]))

    expect(snap.arts.some((p) => p.productId === '482236')).toBe(false)
    expect(snap.prices.some((p) => p.cardCode.startsWith('DON'))).toBe(false)
  })

  /* O codigo e o nosso sintetico: assim cada DON forma grupo proprio e nao se
   * mistura ao casamento por numero das cartas da Bandai. */
  it('leva o codigo sintetico do DON', async () => {
    const snap = await provider().fetchSnapshot(new Map([['OP01-001', 'Monkey.D.Luffy']]))

    expect(snap.otherProducts.find((p) => p.productId === '482236')!.cardCode).toBe('DON-482236')
  })

  /* E a carta da Bandai continua sendo tratada como sempre. */
  it('nao atrapalha a carta com numero', async () => {
    const snap = await provider().fetchSnapshot(new Map([['OP01-001', 'Monkey.D.Luffy']]))

    expect(snap.prices.some((p) => p.cardCode.toUpperCase() === 'OP01-001')).toBe(true)
  })
})
