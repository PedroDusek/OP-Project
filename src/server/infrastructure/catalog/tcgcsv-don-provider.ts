import { DON_TYPE, type CatalogPage, type CatalogProvider } from '@/server/domain/catalog/types'
import {
  donCardCode,
  donVariantType,
  DON_SET_CODE,
  DON_SET_NAME,
} from '@/server/domain/catalog/don'

/**
 * Provedor de catalogo dos DON!!, a partir do espelho tcgcsv (decisao 112).
 *
 * Camada: infrastructure. Faz I/O e nada mais; a identidade das cartas e regra
 * pura e mora em `domain/catalog/don.ts`.
 *
 * ## Por que nao vem da Bandai
 *
 * O catalogo oficial e a lista de cartas **de deck**, e o DON!! nao e uma
 * delas. Conferido de quatro jeitos em 23/09: as 60 series sem nenhum tipo
 * rejeitado, a serie de promocoes com so os quatro tipos, o filtro "Card type"
 * do proprio site oferecendo quatro opcoes, e a busca livre devolvendo zero
 * para `DON!!` enquanto devolve 349 para `Luffy`.
 *
 * ## Por que o tcgcsv serve
 *
 * Ele **rotula o tipo**: `extendedData.CardType === 'DON!!'`. A extracao nao
 * depende de casar o nome, que traria "DON!! Card" escrito em texto de efeito.
 *
 * ## Uma serie por grupo
 *
 * `listSeriesIds` devolve os grupos que tem DON!!, e nao um bloco unico. Assim
 * cada grupo e uma transacao no importador, como acontece com as series da
 * Bandai — um grupo que falhe nao leva os outros junto.
 */

const ORIGIN = 'https://tcgcsv.com'
const BASE = `${ORIGIN}/tcgplayer`

/** One Piece Card Game no TCGplayer, a mesma da importacao de precos. */
const CATEGORY_ID = 68

/**
 * O mesmo `User-Agent` da importacao de precos, e pelo mesmo motivo: o tcgcsv
 * bloqueia quem nao se identifica, com uma resposta em texto que nao e JSON.
 */
const USER_AGENT = 'ColeXa/1.0 (+https://colexa.com.br)'

const DEFAULT_MIN_INTERVAL_MS = 250

interface Group {
  groupId: number
  name: string
  abbreviation: string | null
}

interface Product {
  productId: number
  name: string
  imageUrl?: string | null
  extendedData?: { name: string; value: string }[]
}

export interface TcgCsvDonOptions {
  minIntervalMs?: number
  fetchImpl?: typeof fetch
}

export class TcgCsvDonProvider implements CatalogProvider {
  readonly name = 'tcgcsv-don'

  private readonly minIntervalMs: number
  private readonly fetchImpl: typeof fetch
  private queue: Promise<unknown> = Promise.resolve()
  private lastRequestAt = 0

  /** Os nomes dos grupos, guardados na listagem para o relatorio da importacao. */
  private groupNames = new Map<string, string>()

  constructor(options: TcgCsvDonOptions = {}) {
    this.minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch
  }

  async listSeriesIds(): Promise<string[]> {
    const groups = await this.get<{ results: Group[] }>(`${BASE}/${CATEGORY_ID}/groups`)

    const comDon: string[] = []
    for (const group of groups.results) {
      const id = String(group.groupId)
      this.groupNames.set(id, group.name)
      if ((await this.donsOf(id)).length > 0) comDon.push(id)
    }
    return comDon
  }

  async fetchSeries(seriesId: string): Promise<CatalogPage> {
    if (!/^\d+$/.test(seriesId)) {
      throw new Error(`identificador de grupo invalido: ${seriesId}`)
    }

    const dons = await this.donsOf(seriesId)
    const page: CatalogPage = {
      /*
       * Um set artificial, e nao o grupo do TCGplayer (decisao 112).
       *
       * Os grupos de la nao sao os nossos sets — a abreviacao e `OP18`,
       * `EB-05`, `OP18 RE`, e o nosso codigo vem da Bandai. Mapear os 87 grupos
       * aos 60 sets sem poder conferir seria adivinhar, e adivinhar vinculo ja
       * custou 773 conferencias manuais aqui.
       *
       * O set `DON` e a escolha do dono do produto: os DON!! tem onde morar, e o
       * filtro do catalogo os oferece juntos, que e como a pessoa quer ve-los.
       */
      sets: [{ code: DON_SET_CODE, name: DON_SET_NAME }],
      cards: [],
      variants: [],
      reprints: [],
      rejected: [],
      promotionalProductNames: [],
      variantsWithoutSet: [],
    }

    for (const product of dons) {
      const code = donCardCode(product.productId)
      page.cards.push({
        code,
        name: product.name.trim(),
        type: DON_TYPE,
        /*
         * DON!! nao tem custo, poder, vida nem counter — e aqui nulo quer dizer
         * "nao se aplica", que e exatamente o que a armadilha 87 fixou. Nao e
         * zero, e por isso ele fica fora das faixas de custo e poder.
         */
        cost: null,
        power: null,
        life: null,
        counter: null,
        hasTrigger: false,
        blockIcon: null,
        colors: [],
        traits: [],
        attributes: [],
        mechanics: [],
      })

      page.variants.push({
        sourceId: String(product.productId),
        cardCode: code,
        variantType: donVariantType(product.name),
        rarity: field(product, 'Rarity'),
        /*
         * A imagem vem do CDN do **TCGplayer**, e nao da Bandai — aprovado pelo
         * dono do produto em 23/09.
         *
         * O host precisa estar em `remotePatterns` no `next.config.ts`, e isso
         * nao e detalhe de configuracao: `next/image` recusa host desconhecido
         * com **500 na tela inteira**, e nao com uma imagem quebrada. Foi o que
         * aconteceu em 23/09 na planilha da Liga, assim que as 239 passaram a
         * renderizar. Tirar o host de la derruba o catalogo.
         */
        imageUrl: product.imageUrl?.trim() || null,
        printedInSetCodes: [DON_SET_CODE],
      })
    }

    return page
  }

  /** O nome do grupo, para o relatorio. Vazio antes de `listSeriesIds`. */
  groupName(seriesId: string): string | undefined {
    return this.groupNames.get(seriesId)
  }

  private async donsOf(groupId: string): Promise<Product[]> {
    const products = await this.get<{ results: Product[] }>(
      `${BASE}/${CATEGORY_ID}/${groupId}/products`,
    )
    return products.results.filter((p) => field(p, 'CardType') === 'DON!!')
  }

  /** Requisicoes em fila unica e espacadas, como no provedor de precos. */
  private get<T>(url: string): Promise<T> {
    const next = this.queue.then(async () => {
      const espera = this.minIntervalMs - (Date.now() - this.lastRequestAt)
      if (espera > 0) await new Promise((resolve) => setTimeout(resolve, espera))
      this.lastRequestAt = Date.now()

      const response = await this.fetchImpl(url, {
        headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      })
      if (!response.ok) throw new Error(`${url} respondeu ${response.status}`)
      return (await response.json()) as T
    })

    this.queue = next.catch(() => undefined)
    return next
  }
}

function field(product: Product, name: string): string | null {
  return product.extendedData?.find((e) => e.name === name)?.value?.trim() || null
}
