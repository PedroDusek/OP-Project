import { commonArtByNumber, type SourceProduct } from '@/server/domain/prices/matching'
import { normalProduct, type CommonCandidate } from '@/server/domain/prices/normal-product'
import { marketPriceOf } from '@/server/domain/prices/finish'
import { artProducts, treatmentOf } from '@/server/domain/prices/treatments'
import type {
  KnownCardNames,
  PriceProvider,
  PriceSnapshot,
  SourceArtProduct,
  SourceCommonArt,
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

  async fetchSnapshot(knownNames: KnownCardNames): Promise<PriceSnapshot> {
    const sourceUpdatedAt = await this.sourceUpdatedAt()
    const groups = await this.get<{ results: Group[] }>(`${BASE}/${CATEGORY_ID}/groups`)
    const prices = new Map<string, SourcePrice>()
    const commonArts = new Map<string, SourceCommonArt>()
    const arts = new Map<string, SourceArtProduct>()
    const otherProducts = new Map<string, SourceArtProduct>()
    const comunsPorNumero = new Map<string, CommonCandidate[]>()

    for (const group of groups.results) {
      const [products, quotes] = await Promise.all([
        this.get<{ results: Product[] }>(`${BASE}/${CATEGORY_ID}/${group.groupId}/products`),
        this.get<{ results: Price[] }>(`${BASE}/${CATEGORY_ID}/${group.groupId}/prices`),
      ])

      const market = marketByProduct(quotes.results)
      const cards = products.results.map(toSourceProduct).filter(hasNumber)
      const common = commonArtByNumber(cards, knownNames)

      for (const [number, product] of common) {
        comunsPorNumero.set(number, [
          ...(comunsPorNumero.get(number) ?? []),
          {
            productId: String(product.productId),
            groupCode: group.abbreviation ?? group.name,
            value: market.get(product.productId),
          },
        ])
      }

      /*
       * As demais artes, por produto e não por número: uma carta tem várias, e
       * o id do produto é o que as distingue. União entre grupos — a mesma arte
       * aparece no set de origem e em cada produto que a reimprime, e ficar com
       * o primeiro perderia as artes do set original quando uma reimpressão
       * chegasse antes.
       */
      for (const product of cards) {
        const number = product.number.trim().toUpperCase()
        const daCarta = cards.filter((c) => c.number.trim().toUpperCase() === number)

        const comum = common.get(number) ?? null
        const artesDaCarta = artProducts(daCarta, comum)
        for (const art of artesDaCarta) {
          const id = String(art.productId)
          if (arts.has(id)) continue

          arts.set(id, {
            cardCode: number,
            productId: id,
            label: treatmentOf(art, comum?.name ?? null),
            value: market.get(art.productId) ?? null,
            groupCode: group.abbreviation ?? group.name,
          })
        }

        /*
         * O resto dos produtos com numero — embalagem, reimpressao, colecao
         * premium, e a carta sem tratamento que saiu em outro grupo (a Nami do
         * ST-31) —, para a regra da Liga (decisao 072). A arte comum de cada
         * grupo entra tambem; a que ficar com o preco da normal sai no fim.
         */
        const ehArte = new Set(artesDaCarta.map((art) => art.productId))
        for (const outro of daCarta) {
          const id = String(outro.productId)
          if (ehArte.has(outro.productId)) continue
          if (otherProducts.has(id) || arts.has(id)) continue

          otherProducts.set(id, {
            cardCode: number,
            productId: id,
            label: treatmentOf(outro, comum?.name ?? null),
            value: market.get(outro.productId) ?? null,
            groupCode: group.abbreviation ?? group.name,
          })
        }
      }
    }

    /*
     * A normal fica com a arte comum do grupo da colecao do codigo (decisao 076):
     * a Zoro `OP01-001` e a do `OP01`, a US$ 2,15, e nao a reimpressao do `OP-DD`,
     * a US$ 8,30. Sem esse grupo — as promos `P-`, ou a colecao sem a carta —,
     * fica a primeira na ordem da fonte, como antes. Com a escolha feita, a
     * arte comum sai dos demais produtos: ela ja tem dono.
     */
    for (const [number, candidatas] of comunsPorNumero) {
      const escolhida = normalProduct(number, candidatas)
      commonArts.set(number, {
        cardCode: number,
        productId: escolhida.productId,
        groupCode: candidatas.find((c) => c.productId === escolhida.productId)?.groupCode ?? null,
      })
      otherProducts.delete(escolhida.productId)
      if (escolhida.value !== null) {
        prices.set(number, { cardCode: number, value: escolhida.value, currency: 'USD' })
      }
    }

    this.logger.info(
      `[precos] ${commonArts.size} artes comuns (${prices.size} com preço), ` +
        `${arts.size} outras artes e ${otherProducts.size} demais produtos em ` +
        `${groups.results.length} grupos`,
    )
    return {
      prices: [...prices.values()],
      commonArts: [...commonArts.values()],
      arts: [...arts.values()],
      otherProducts: [...otherProducts.values()],
      sourceUpdatedAt,
    }
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
 * O preço de mercado por produto (decisões 050 e 078).
 *
 * `subTypeName` é o **acabamento**, não a arte: o mesmo produto aparece como
 * `Normal` e como `Foil`. Em One Piece a impressão base de líder, SR e SEC é
 * foil, então filtrar por `Normal` — como esta função fazia — descartava o
 * preço de 870 cartas cuja única cotação era a foil. A cobertura subiu de 64%
 * para 95% ao parar de fazer isso.
 *
 * Com uma cotação só, é ela. Com as duas, vale a `Normal` (decisão 078): antes
 * não havia preço, e as 5 normais das coleções antigas — a `OP02-041` cota 0,39
 * e 0,82 — ficaram sem valor quando a 076 parou de dar a elas o preço de uma
 * reimpressão.
 *
 * Sem preço de mercado o produto fica de fora: `lowPrice` é a oferta mais
 * barata de um vendedor, não o valor da carta.
 */
function marketByProduct(prices: readonly Price[]): Map<number, number> {
  const byProduct = new Map<number, { subType: string | null; value: number }[]>()

  for (const price of prices) {
    if (price.marketPrice === null || price.marketPrice <= 0) continue
    const cotacao = { subType: price.subTypeName, value: price.marketPrice }
    byProduct.set(price.productId, [...(byProduct.get(price.productId) ?? []), cotacao])
  }

  const market = new Map<number, number>()
  for (const [productId, cotacoes] of byProduct) {
    const value = marketPriceOf(cotacoes)
    if (value !== null) market.set(productId, value)
  }

  return market
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
