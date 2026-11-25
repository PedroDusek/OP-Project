import { PROMO_SET, type CardDTO, type CatalogPage, type CatalogProvider } from '@/server/domain/catalog/types'
import {
  sealedLeaderCardCode,
  SEALED_LEADER_PRODUCT_IDS,
} from '@/server/domain/catalog/lider-selado'

/**
 * Provedor dos líderes de evento selado, a partir do espelho tcgcsv
 * (decisão 115).
 *
 * Camada: infrastructure. Faz I/O e nada mais; a identidade das cartas e a
 * escolha de quais entram são regra pura e moram em `domain/catalog/lider-selado.ts`.
 *
 * Irmão do provedor dos DON!!, e de propósito: a situação é a mesma — carta que
 * a Bandai não publica na lista, sem número de origem, que o TCGplayer tem. O
 * que muda é que aqui a lista é **nominal**, porque quais entram é escolha do
 * dono do produto e não uma regra que pesque sozinha.
 *
 * ## Uma série só
 *
 * `listSeriesIds` devolve um identificador fixo, e não os grupos da fonte. São
 * poucos produtos escolhidos a dedo, todos no mesmo grupo de promoções: dividir
 * em séries daria uma transação por carta sem ganho nenhum.
 *
 * ## Por que não lê o grupo inteiro e filtra por "seis cores"
 *
 * Porque pescaria os outros três líderes selados que a fonte tem, e o dono do
 * produto escolheu só um. A regra seria mais curta e responderia outra pergunta.
 */

const ORIGIN = 'https://tcgcsv.com'
const BASE = `${ORIGIN}/tcgplayer`

/** One Piece Card Game no TCGplayer, a mesma da importação de preços. */
const CATEGORY_ID = 68

/** O grupo "One Piece Promotion Cards", onde estes produtos vivem. */
const PROMO_GROUP_ID = 17675

/**
 * O mesmo `User-Agent` da importação de preços, e pelo mesmo motivo: o tcgcsv
 * bloqueia quem não se identifica, com uma resposta em texto que não é JSON.
 */
const USER_AGENT = 'ColeXa/1.0 (+https://colexa.com.br)'

/** A única série. O importador trata séries como opacas, então o nome é livre. */
const SERIE = 'lideres-selados'

interface Product {
  productId: number
  name: string
  imageUrl?: string | null
  extendedData?: { name: string; value: string }[]
}

function campo(product: Product, nome: string): string | null {
  const valor = product.extendedData?.find((entrada) => entrada.name === nome)?.value
  const texto = valor?.trim()
  return texto === undefined || texto === '' ? null : texto
}

/** `"5000"` → `5000`; ausente ou ilegível → `null`, que é "não se aplica". */
function numero(product: Product, nome: string): number | null {
  const texto = campo(product, nome)
  if (texto === null) return null
  const valor = Number.parseInt(texto.replace(/[^\d-]/g, ''), 10)
  return Number.isNaN(valor) ? null : valor
}

/** `"Blue;Green;Purple"` → as três. A fonte separa por ponto e vírgula. */
function lista(product: Product, nome: string): string[] {
  const texto = campo(product, nome)
  if (texto === null) return []
  return texto
    .split(';')
    .map((item) => item.trim())
    .filter((item) => item !== '')
}

export interface TcgCsvSealedLeaderOptions {
  fetchImpl?: typeof fetch
  /** Os produtos a trazer. O padrão é a escolha registrada no domínio. */
  productIds?: readonly number[]
}

export class TcgCsvSealedLeaderProvider implements CatalogProvider {
  readonly name = 'tcgcsv-lider-selado'

  private readonly fetchImpl: typeof fetch
  private readonly productIds: readonly number[]

  constructor(options: TcgCsvSealedLeaderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch
    this.productIds = options.productIds ?? SEALED_LEADER_PRODUCT_IDS
  }

  listSeriesIds(): Promise<string[]> {
    return Promise.resolve([SERIE])
  }

  async fetchSeries(seriesId: string): Promise<CatalogPage> {
    if (seriesId !== SERIE) throw new Error(`serie desconhecida: ${seriesId}`)

    const resposta = await this.get<{ results: Product[] }>(
      `${BASE}/${CATEGORY_ID}/${PROMO_GROUP_ID}/products`,
    )

    const porId = new Map(resposta.results.map((produto) => [produto.productId, produto]))

    const page: CatalogPage = {
      /*
       * O set de promoções, que **já existe** (decisão 024) — e não um set
       * artificial como o do DON!!. A diferença é que o DON!! não cabia em
       * nenhum set nosso, e este cabe: ele é um produto promocional, e é assim
       * que a fonte o classifica.
       */
      sets: [PROMO_SET],
      cards: [],
      variants: [],
      reprints: [],
      rejected: [],
      promotionalProductNames: [],
      variantsWithoutSet: [],
    }

    for (const productId of this.productIds) {
      const produto = porId.get(productId)

      /*
       * Produto que sumiu da fonte e recusa anotada, em vez de erro: a lista e
       * o espelho do TCGplayer mudam em ritmos diferentes, e derrubar a
       * importacao inteira por um id que saiu de catalogo seria caro demais
       * para o que custa anotar.
       */
      if (!produto) {
        page.rejected.push({
          sourceId: String(productId),
          reason: 'produto nao encontrado no grupo de promocoes',
        })
        continue
      }

      const code = sealedLeaderCardCode(productId)
      const carta: CardDTO = {
        code,
        name: produto.name.trim(),
        type: 'Leader',
        /*
         * Leader nao tem custo nem counter, e nulo aqui quer dizer "nao se
         * aplica" — nao zero (armadilha 87). Vida e poder ele tem.
         */
        cost: null,
        power: numero(produto, 'Power'),
        life: numero(produto, 'Life'),
        counter: null,
        hasTrigger: false,
        blockIcon: null,
        colors: lista(produto, 'Color'),
        traits: lista(produto, 'Subtypes'),
        attributes: lista(produto, 'Attribute'),
        mechanics: [],
      }
      page.cards.push(carta)

      /*
       * O nome do produto no relatorio, como a decisao 024 pede para tudo que
       * cai no set PROMO: o agrupamento perde de qual evento a carta veio, e a
       * lista e o que torna visivel o que foi colapsado.
       */
      page.promotionalProductNames.push(carta.name)

      page.variants.push({
        sourceId: String(productId),
        cardCode: code,
        /*
         * `Normal`: a fonte publica uma arte por produto escolhido, e nao ha o
         * que distinguir. Mesma linha da decisao 023 — so o que o dado permite
         * afirmar.
         */
        variantType: 'Normal',
        rarity: campo(produto, 'Rarity'),
        /*
         * A imagem vem do CDN do TCGplayer, como a dos DON!!. O host ja esta em
         * `remotePatterns` no `next.config.ts` por causa deles — tirar de la
         * derruba o catalogo com 500, e nao com imagem quebrada.
         */
        imageUrl: produto.imageUrl?.trim() || null,
        printedInSetCodes: [PROMO_SET.code],
      })
    }

    return page
  }

  private async get<T>(url: string): Promise<T> {
    const resposta = await this.fetchImpl(url, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
    })

    if (!resposta.ok) {
      throw new Error(`tcgcsv respondeu ${resposta.status} em ${url}`)
    }

    return (await resposta.json()) as T
  }
}
