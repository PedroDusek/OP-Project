import { commonArtByNumber, type SourceProduct } from '@/server/domain/prices/matching'
import type {
  KnownCardNames,
  PriceProvider,
  PriceSnapshot,
  SourcePrice,
} from '@/server/http/price-provider'

/**
 * Preços do TCGplayer pelo espelho diário do tcgcsv (decisão 050).
 *
 * Camada: infrastructure.
 *
 * ## Por que este espelho, e não a API da fonte
 *
 * A TCGplayer não concede acesso novo à API: a Partner API foi depreciada em
 * 2023 e as consultas dizem que novas credenciais não são emitidas. O tcgcsv
 * publica o catálogo e os preços deles em arquivo, uma vez por dia, sem chave.
 *
 * ## Por que arquivo em lote importa tanto
 *
 * São 4.431 variantes no nosso catálogo. Uma fonte por carta exigiria 4.431
 * requisições — mais de duas horas no intervalo de cortesia do projeto, todo
 * dia, contra servidor de terceiro. Aqui são 87 grupos: um punhado de arquivos.
 *
 * O intervalo entre requisições é o mesmo do catálogo, e pelo mesmo motivo: a
 * infraestrutura é de outra pessoa, e ninguém pediu para ser martelado.
 *
 * ## O `User-Agent` não é enfeite
 *
 * O `fetch` do Node não manda nenhum, e o host responde **401** a quem chega
 * sem se identificar. Além de destravar, é o mínimo de educação: quem hospeda
 * consegue ver quem está consumindo e falar com a gente se precisar.
 *
 * ## De quando é o dado
 *
 * A fonte publica o próprio carimbo em `last-updated.txt`, e ele volta junto
 * com os preços. Importa porque o espelho é atualizado **às 20:00 UTC** — 17:00
 * aqui — e a nossa importação roda de madrugada: o dado que chega às 04:00 é do
 * fim da tarde anterior. A tela pode dizer quando conferimos sem dar a entender
 * que o mercado foi lido naquele instante.
 */

const ORIGIN = 'https://tcgcsv.com'
const BASE = `${ORIGIN}/tcgplayer`

/** O One Piece Card Game no catálogo da fonte. */
const CATEGORY_ID = 68

/** Cortesia com quem hospeda, como na importação do catálogo (decisão 020). */
const DEFAULT_MIN_INTERVAL_MS = 250

/** Identifica a aplicação para quem hospeda. Sem isto, a fonte responde 401. */
const USER_AGENT = 'ColeXa/1.0 (+https://colexa.com.br)'

interface Group {
  groupId: number
  name: string
  abbreviation: string | null
}

interface Product {
  productId: number
  name: string
  extendedData?: { name: string; value: string }[]
}

interface Price {
  productId: number
  marketPrice: number | null
  subTypeName: string | null
}

export interface TcgCsvOptions {
  minIntervalMs?: number
  fetchImpl?: typeof fetch
  logger?: Pick<Console, 'info' | 'warn'>
}

export class TcgCsvPriceProvider implements PriceProvider {
  readonly name = 'tcgcsv'

  private readonly minIntervalMs: number
  private readonly fetchImpl: typeof fetch
  private readonly logger: Pick<Console, 'info' | 'warn'>
  private lastRequestAt = 0

  constructor(options: TcgCsvOptions = {}) {
    this.minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS
    this.fetchImpl = options.fetchImpl ?? fetch
    this.logger = options.logger ?? console
  }

  async fetchCommonArtPrices(knownNames: KnownCardNames): Promise<PriceSnapshot> {
    const sourceUpdatedAt = await this.sourceUpdatedAt()
    const groups = await this.get<{ results: Group[] }>(`${BASE}/${CATEGORY_ID}/groups`)
    const prices = new Map<string, SourcePrice>()

    for (const group of groups.results) {
      const [products, quotes] = await Promise.all([
        this.get<{ results: Product[] }>(`${BASE}/${CATEGORY_ID}/${group.groupId}/products`),
        this.get<{ results: Price[] }>(`${BASE}/${CATEGORY_ID}/${group.groupId}/prices`),
      ])

      const market = marketByProduct(quotes.results)
      const cards = products.results.map(toSourceProduct).filter(hasNumber)
      const common = commonArtByNumber(cards, knownNames)

      for (const [number, product] of common) {
        const value = market.get(product.productId)
        if (value === undefined) continue

        /*
         * O mesmo número aparece em mais de um grupo — a coleção original e as
         * reimpressões. Fica o primeiro, e os grupos vêm na ordem da fonte, que
         * começa pelos lançamentos. Repetir a decisão a cada grupo faria o preço
         * depender de qual arquivo chegou por último.
         */
        if (!prices.has(number)) {
          prices.set(number, { cardCode: number, value, currency: 'USD' })
        }
      }
    }

    this.logger.info(
      `[precos] ${prices.size} artes comuns com preço em ${groups.results.length} grupos`,
    )
    return { prices: [...prices.values()], sourceUpdatedAt }
  }

  /**
   * O carimbo que a fonte publica, ou nulo.
   *
   * Nulo e não exceção: não saber de quando é o dado deixa a tela um pouco mais
   * vaga, mas abortar a importação inteira por causa de um arquivo de texto
   * seria trocar todos os preços por nenhum.
   */
  private async sourceUpdatedAt(): Promise<Date | null> {
    try {
      const response = await this.fetchImpl(`${ORIGIN}/last-updated.txt`, {
        headers: { 'user-agent': USER_AGENT },
      })
      if (!response.ok) return null

      const parsed = new Date((await response.text()).trim())
      return Number.isNaN(parsed.getTime()) ? null : parsed
    } catch {
      return null
    }
  }

  /** Serializa e respeita o intervalo mínimo, como o provedor do catálogo. */
  private async get<T>(url: string): Promise<T> {
    const waitFor = this.lastRequestAt + this.minIntervalMs - Date.now()
    if (waitFor > 0) await delay(waitFor)
    this.lastRequestAt = Date.now()

    const response = await this.fetchImpl(url, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
    })
    if (!response.ok) throw new Error(`Falha ao ler ${url}: ${response.status}`)
    return (await response.json()) as T
  }
}

/** Só produtos com `Number` são carta; o resto é booster, caixa, playmat. */
function toSourceProduct(product: Product): SourceProduct {
  const number = product.extendedData?.find((field) => field.name === 'Number')?.value ?? ''
  return { productId: product.productId, name: product.name, number }
}

function hasNumber(product: SourceProduct): boolean {
  return product.number !== ''
}

/**
 * O preço de mercado por produto, quando há um só.
 *
 * `subTypeName` é o **acabamento**, não a arte: o mesmo produto aparece como
 * `Normal` e como `Foil`. Em One Piece a impressão base de líder, SR e SEC é
 * foil, então filtrar por `Normal` — como esta função fazia — descartava o
 * preço de 870 cartas cuja única cotação era a foil. A cobertura subiu de 64%
 * para 95% ao parar de fazer isso.
 *
 * Quando o mesmo produto tem cotação nos dois acabamentos, não há preço: são
 * dois valores reais de duas impressões reais, e o nosso modelo guarda uma
 * variante só. Escolher um seria inventar — o `ST01-001 Monkey.D.Luffy` cota
 * 18,52 e 9,93, e a diferença não é arredondamento. São 5 cartas.
 *
 * Sem preço de mercado o produto fica de fora: `lowPrice` é a oferta mais
 * barata de um vendedor, não o valor da carta.
 */
function marketByProduct(prices: readonly Price[]): Map<number, number> {
  const byProduct = new Map<number, number[]>()

  for (const price of prices) {
    if (price.marketPrice === null || price.marketPrice <= 0) continue
    const found = byProduct.get(price.productId)
    if (found) found.push(price.marketPrice)
    else byProduct.set(price.productId, [price.marketPrice])
  }

  const single = new Map<number, number>()
  for (const [productId, values] of byProduct) {
    if (values.length === 1) single.set(productId, values[0])
  }

  return single
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
