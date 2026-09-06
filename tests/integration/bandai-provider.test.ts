import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BandaiCatalogProvider } from '@/server/infrastructure/catalog/bandai-catalog-provider'

/**
 * Sem rede: o fetch e injetado. O que se verifica aqui sao as mitigacoes da
 * decisao 020, que sao obrigacao e nao recomendacao.
 */

const html = readFileSync(
  fileURLToPath(new URL('../fixtures/bandai-cardlist-sample.html', import.meta.url)),
  'utf8',
)

function okResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/html' } })
}

describe('provedor de catalogo da fonte oficial', () => {
  it('respeita o intervalo minimo entre requisicoes', async () => {
    const timestamps: number[] = []
    const provider = new BandaiCatalogProvider({
      minIntervalMs: 120,
      fetchImpl: async () => {
        timestamps.push(Date.now())
        return okResponse(html)
      },
    })

    await provider.fetchSeries('1')
    await provider.fetchSeries('2')
    await provider.fetchSeries('3')

    expect(timestamps).toHaveLength(3)
    for (let i = 1; i < timestamps.length; i += 1) {
      // Margem de folga para o relogio do agendador.
      expect(timestamps[i] - timestamps[i - 1]).toBeGreaterThanOrEqual(100)
    }
  })

  it('serializa chamadas concorrentes em vez de abrir varias conexoes', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const provider = new BandaiCatalogProvider({
      minIntervalMs: 0,
      fetchImpl: async () => {
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((r) => setTimeout(r, 30))
        inFlight -= 1
        return okResponse(html)
      },
    })

    await Promise.all([
      provider.fetchSeries('1'),
      provider.fetchSeries('2'),
      provider.fetchSeries('3'),
    ])

    expect(maxInFlight).toBe(1)
  })

  it('uma falha nao trava a fila para as requisicoes seguintes', async () => {
    let call = 0
    const provider = new BandaiCatalogProvider({
      minIntervalMs: 0,
      fetchImpl: async () => {
        call += 1
        if (call === 1) throw new Error('rede caiu')
        return okResponse(html)
      },
    })

    await expect(provider.fetchSeries('1')).rejects.toThrow('rede caiu')
    const page = await provider.fetchSeries('2')
    expect(page.variants.length).toBeGreaterThan(0)
  })

  it('trata resposta de erro da origem como falha, e nao como pagina vazia', async () => {
    const provider = new BandaiCatalogProvider({
      minIntervalMs: 0,
      fetchImpl: async () => new Response('nope', { status: 503 }),
    })
    await expect(provider.fetchSeries('1')).rejects.toThrow('503')
  })

  it('recusa identificador de serie que nao seja numerico', async () => {
    const provider = new BandaiCatalogProvider({
      minIntervalMs: 0,
      fetchImpl: async () => okResponse(html),
    })
    await expect(provider.fetchSeries('../../etc')).rejects.toThrow('invalido')
  })

  it('extrai os identificadores de serie da pagina', async () => {
    const provider = new BandaiCatalogProvider({
      minIntervalMs: 0,
      fetchImpl: async () =>
        okResponse('<select><option value="569117">A</option><option value="569116">B</option></select>'),
    })
    expect(await provider.listSeriesIds()).toEqual(['569117', '569116'])
  })
})
