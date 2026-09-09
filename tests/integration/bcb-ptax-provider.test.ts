import { describe, expect, it } from 'vitest'
import { BcbPtaxProvider } from '@/server/infrastructure/prices/bcb-ptax-provider'

/**
 * O provedor de cambio do Banco Central.
 *
 * Sem rede: o `fetch` e injetado e devolve as respostas que o servico de
 * verdade devolve — inclusive a mais importante delas, que e a lista vazia de
 * um sabado. O que se protege e que dia sem cotacao nao vire erro nem zero.
 */

const silent = { info: () => {}, warn: () => {} }

/** Uma resposta real do servico, com os numeros de 04/09/2026. */
const COTACAO = {
  value: [{ cotacaoCompra: 5.1247, cotacaoVenda: 5.1253, dataHoraCotacao: '2026-09-04 13:03:59' }],
}

/** O que o servico devolve num sabado: lista vazia, e nao erro. */
const VAZIO = { value: [] }

function fakeFetch(byDate: Record<string, unknown>) {
  const asked: string[] = []

  const impl = (async (url: string | URL) => {
    const href = String(url)
    const day = /@dataCotacao='([^']+)'/.exec(href)?.[1] ?? ''
    asked.push(day)

    return {
      ok: true,
      json: async () => byDate[day] ?? VAZIO,
    } as Response
  }) as unknown as typeof fetch

  return { impl, asked }
}

describe('cotacao do dia', () => {
  it('devolve a cotacao de venda, e nao a de compra', async () => {
    const { impl } = fakeFetch({ '09-04-2026': COTACAO })
    const provider = new BcbPtaxProvider({ fetchImpl: impl, logger: silent })

    const rate = await provider.fetchLatestUsdBrl(new Date('2026-09-04T12:00:00Z'))

    expect(rate).toMatchObject({ base: 'USD', quote: 'BRL', rate: 5.1253 })
  })

  it('devolve a data da cotacao, e nao a da consulta', async () => {
    const { impl } = fakeFetch({ '09-04-2026': COTACAO })
    const provider = new BcbPtaxProvider({ fetchImpl: impl, logger: silent })

    const rate = await provider.fetchLatestUsdBrl(new Date('2026-09-04T23:00:00Z'))

    expect(rate?.quoteDate.toISOString().slice(0, 10)).toBe('2026-09-04')
  })
})

describe('dia sem cotacao', () => {
  /**
   * O PTAX nao existe em sabado, domingo nem feriado bancario, e o servico
   * responde lista vazia. Andar para tras e a unica forma de ter numero na
   * segunda-feira de manha.
   */
  it('anda para tras ate achar o ultimo dia util', async () => {
    const { impl, asked } = fakeFetch({ '09-04-2026': COTACAO })
    const provider = new BcbPtaxProvider({ fetchImpl: impl, logger: silent })

    // Segunda-feira: sabado e domingo vem vazios.
    const rate = await provider.fetchLatestUsdBrl(new Date('2026-09-07T09:00:00Z'))

    expect(rate).toMatchObject({ rate: 5.1253 })
    expect(rate?.quoteDate.toISOString().slice(0, 10)).toBe('2026-09-04')
    expect(asked).toEqual(['09-07-2026', '09-06-2026', '09-05-2026', '09-04-2026'])
  })

  it('desiste depois de cinco dias, em vez de andar para sempre', async () => {
    const { impl, asked } = fakeFetch({})
    const provider = new BcbPtaxProvider({ fetchImpl: impl, logger: silent })

    const rate = await provider.fetchLatestUsdBrl(new Date('2026-09-07T09:00:00Z'))

    expect(rate).toBeNull()
    expect(asked).toHaveLength(6)
  })

  /** Cotacao zerada e dado quebrado, e nao um achado. */
  it('trata cotacao zerada como ausencia', async () => {
    const { impl } = fakeFetch({
      '09-04-2026': { value: [{ cotacaoCompra: 0, cotacaoVenda: 0, dataHoraCotacao: '' }] },
    })
    const provider = new BcbPtaxProvider({ fetchImpl: impl, logger: silent })

    expect(await provider.fetchLatestUsdBrl(new Date('2026-09-04T12:00:00Z'))).toBeNull()
  })
})

describe('falha da fonte', () => {
  /**
   * Lista vazia significa "sabado"; HTTP 500 significa "o servico caiu". Tratar
   * os dois igual faria uma queda do Banco Central virar silenciosamente uma
   * cotacao de cinco dias atras.
   */
  it('levanta erro quando o servico responde falha', async () => {
    const impl = (async () => ({ ok: false, status: 503 }) as Response) as unknown as typeof fetch
    const provider = new BcbPtaxProvider({ fetchImpl: impl, logger: silent })

    await expect(provider.fetchLatestUsdBrl(new Date('2026-09-04T12:00:00Z'))).rejects.toThrow(
      '503',
    )
  })
})
