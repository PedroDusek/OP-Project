import { parseCardList } from '@/server/domain/catalog/parse-card-list'
import type { CatalogPage, CatalogProvider } from '@/server/domain/catalog/types'

/**
 * Provedor de catalogo a partir da listagem oficial.
 *
 * Camada: infrastructure. Faz I/O e nada mais: toda a extracao vive no parser
 * puro do dominio, que e testado com fixture e sem rede.
 *
 * As mitigacoes da decisao 020 sao implementadas aqui e nao sao opcionais:
 * requisicoes serializadas, intervalo minimo entre elas, e imagens apenas
 * referenciadas na origem, nunca baixadas.
 */

const BASE_URL = 'https://en.onepiece-cardgame.com/cardlist/'

export interface BandaiProviderOptions {
  /** Intervalo minimo entre requisicoes, em milissegundos. */
  minIntervalMs?: number
  requestTimeoutMs?: number
  /** Injetavel para teste. Por padrao usa o fetch global. */
  fetchImpl?: typeof fetch
}

const DEFAULT_MIN_INTERVAL_MS = 1_500
const DEFAULT_TIMEOUT_MS = 30_000

export class BandaiCatalogProvider implements CatalogProvider {
  readonly name = 'bandai'

  private readonly minIntervalMs: number
  private readonly requestTimeoutMs: number
  private readonly fetchImpl: typeof fetch

  /**
   * Encadeia as requisicoes numa fila unica. Duas chamadas concorrentes nao
   * viram duas conexoes simultaneas com a origem, que e o comportamento que a
   * decisao 020 pede evitar.
   */
  private queue: Promise<unknown> = Promise.resolve()
  private lastRequestAt = 0

  constructor(options: BandaiProviderOptions = {}) {
    this.minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch
  }

  async listSeriesIds(): Promise<string[]> {
    const html = await this.get(BASE_URL)
    const ids = Array.from(
      html.matchAll(/<option[^>]+value="(\d+)"/g),
      (match) => match[1],
    )
    return [...new Set(ids)]
  }

  async fetchSeries(seriesId: string): Promise<CatalogPage> {
    if (!/^\d+$/.test(seriesId)) {
      throw new Error(`identificador de serie invalido: ${seriesId}`)
    }
    const html = await this.get(`${BASE_URL}?series=${seriesId}`)
    return parseCardList(html)
  }

  /** Serializa, respeita o intervalo minimo e aplica timeout. */
  private get(url: string): Promise<string> {
    const run = this.queue.then(async () => {
      const waitFor = this.minIntervalMs - (Date.now() - this.lastRequestAt)
      if (waitFor > 0) await delay(waitFor)
      this.lastRequestAt = Date.now()

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs)
      try {
        const response = await this.fetchImpl(url, {
          signal: controller.signal,
          redirect: 'follow',
          headers: {
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        })
        if (!response.ok) {
          throw new Error(`a origem respondeu ${response.status} para ${url}`)
        }
        return await response.text()
      } finally {
        clearTimeout(timeout)
      }
    })

    // A fila nao pode ser envenenada por uma falha: o proximo pedido segue.
    this.queue = run.catch(() => undefined)
    return run
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
