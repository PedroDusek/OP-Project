import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

import { useLiveTrade } from '@/components/trades/use-live-trade'

/**
 * A negociacao ao vivo (decisao 065).
 *
 * Uma consulta a cada dois segundos, e `router.refresh()` quando algo muda. O
 * que se protege aqui e o **criterio**: redesenhar quando mudou, e so quando
 * mudou. Redesenhar a toa faria a tela piscar duas vezes por segundo; nao
 * redesenhar deixaria a pessoa montando uma oferta contra um estado velho.
 */

function respostaCom(corpo: Record<string, unknown>) {
  return { ok: true, json: async () => corpo }
}

beforeEach(() => {
  refresh.mockClear()
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    configurable: true,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('a consulta', () => {
  it('pergunta pelo estado da troca ao abrir', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaCom({ status: 'NEGOTIATING' }))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useLiveTrade('7', true))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0][0]).toBe('/api/trocas/7/estado')
  })

  /*
   * Sem isto, abrir a tela dispararia um `refresh` imediato — redesenhando a
   * pagina que o servidor acabou de mandar.
   */
  it('nao redesenha na primeira resposta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaCom({ status: 'NEGOTIATING' }))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useLiveTrade('7', true))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(refresh).not.toHaveBeenCalled()
  })

  it('nao faz nada quando a troca ja terminou', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaCom({ status: 'COMPLETED' }))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useLiveTrade('7', false))

    await new Promise((r) => setTimeout(r, 50))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  /* Rede instavel nao derruba a negociacao: a tela mostra o que ja tinha. */
  it('engole falha de rede sem redesenhar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sem rede')))

    renderHook(() => useLiveTrade('7', true))

    await new Promise((r) => setTimeout(r, 50))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('nao redesenha quando a resposta e a mesma', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaCom({ status: 'NEGOTIATING' }))
    vi.stubGlobal('fetch', fetchMock)

    const { rerender } = renderHook(() => useLiveTrade('7', true))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    rerender()
    await new Promise((r) => setTimeout(r, 30))

    expect(refresh).not.toHaveBeenCalled()
  })

  /*
   * O caso que a feature existe para resolver: o outro pos uma carta, e a minha
   * tela precisa mostrar.
   */
  it('redesenha quando o estado muda', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respostaCom({ status: 'NEGOTIATING', otherItems: 0 }))
      .mockResolvedValue(respostaCom({ status: 'NEGOTIATING', otherItems: 1 }))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useLiveTrade('7', true))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    // A volta da aba dispara uma pergunta imediata, sem esperar o ciclo.
    document.dispatchEvent(new Event('visibilitychange'))

    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })
})

describe('a aba em segundo plano', () => {
  /*
   * Perguntar a cada dois segundos numa aba escondida e cota de leitura gasta
   * para desenhar o que ninguem esta vendo (decisao 039).
   */
  it('nao pergunta de novo enquanto a aba esta escondida', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaCom({ status: 'NEGOTIATING' }))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useLiveTrade('7', true))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    await new Promise((r) => setTimeout(r, 60))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
