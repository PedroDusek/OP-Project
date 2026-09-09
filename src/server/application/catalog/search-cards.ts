import type { Prisma, PrismaClient } from '@prisma/client'
import type { CardType } from '@/server/domain/catalog/types'
import { compareSetsForCatalog } from '@/server/domain/catalog/sets'

/**
 * Busca no catalogo.
 *
 * Camada: application.
 *
 * Filtro e paginacao sao sempre do servidor. O catalogo nunca e carregado
 * inteiro numa requisicao, nem no cliente. A unidade do resultado e a
 * variante, e nao a carta, porque a grade mostra arte e porque raridade e tipo
 * de variante sao filtros.
 */

/**
 * Um filtro que aceita mais de um valor.
 *
 * Dentro de uma faceta os valores se somam por **ou**: marcar Preto e Azul pede
 * "preta ou azul", nao "preta e azul ao mesmo tempo". Entre facetas vale o
 * **e**: cor azul com raridade SR pede as duas coisas.
 *
 * E a combinacao que responde a pergunta que se faz montando deck, e a unica em
 * que acrescentar um valor nunca reduz o resultado a zero sozinho — que era o
 * que acontecia quando cada faceta so aceitava um.
 */
export type Many<T extends string = string> = T | T[]

export interface CatalogFilters {
  /**
   * A caixa de busca unica da interface: casa por trecho do **codigo ou** do
   * nome.
   *
   * Existe separado de `code` e `name` porque quem digita "OP01" nao esta
   * pedindo um codigo exato nem um nome — esta pedindo "me mostre o que casa".
   * Obrigar a escolher o campo antes de buscar e o tipo de exigencia que faz
   * sentido para quem escreveu o banco e para mais ninguem.
   */
  search?: string
  /** Busca exata por codigo. Vai direto ao indice unico. */
  code?: string
  /** Busca por trecho do nome, sem diferenciar maiusculas. Usa o indice GIN. */
  name?: string
  setCode?: string
  type?: Many<CardType>
  color?: Many<string>
  trait?: Many<string>
  attribute?: Many<string>
  mechanic?: Many<string>
  effect?: Many<string>
  rarity?: Many<string>
  variantType?: Many<string>
  /**
   * Custo e poder entram como faixa, e nao como valor exato.
   *
   * "Character de custo 3" e uma pergunta rara; "o que cabe ate 3 de custo" e a
   * pergunta que se faz montando deck, e e a que as telas de referencia
   * mostram. Valor exato continua possivel: e a faixa com minimo igual ao
   * maximo.
   */
  costMin?: number
  costMax?: number
  powerMin?: number
  powerMax?: number
  counter?: number
  hasTrigger?: boolean
  blockIcon?: string
}

export interface CatalogQuery extends CatalogFilters {
  page?: number
  pageSize?: number
}

export interface CatalogResultItem {
  variantId: bigint
  sourceId: string | null
  cardCode: string
  cardName: string
  type: string
  variantType: string
  rarity: string | null
  imageUrl: string | null
  cost: number | null
  power: number | null
  counter: number | null
  hasTrigger: boolean
}

export interface CatalogResult {
  items: CatalogResultItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const DEFAULT_PAGE_SIZE = 24
const MAX_PAGE_SIZE = 100

/**
 * Faixa numerica para o Prisma, ou `null` quando nao ha filtro.
 *
 * Um limite so ja filtra: informar apenas o maximo responde "ate 3 de custo".
 * Faixa invertida (minimo maior que o maximo) nao vira erro nem e corrigida em
 * silencio — ela filtra para o conjunto vazio, que e literalmente o que foi
 * pedido, e a tela mostra o estado vazio em vez de resultados que a pessoa nao
 * pediu.
 */
/**
 * Normaliza um filtro para lista, descartando vazio.
 *
 * Devolve `undefined` quando nao ha nada a filtrar, para o chamador nao
 * precisar distinguir "sem filtro" de "lista vazia" — uma lista vazia num `in`
 * do Prisma nao devolve nada, que e o oposto do que "sem filtro" significa.
 */
function many<T extends string>(value?: Many<T>): T[] | undefined {
  if (value === undefined) return undefined
  const list = (Array.isArray(value) ? value : [value]).filter((item) => item !== '')
  return list.length > 0 ? list : undefined
}

function range(min?: number, max?: number): { gte?: number; lte?: number } | null {
  if (min === undefined && max === undefined) return null
  return {
    ...(min !== undefined ? { gte: min } : {}),
    ...(max !== undefined ? { lte: max } : {}),
  }
}

export function buildCatalogWhere(filters: CatalogFilters): Prisma.CardVariantWhereInput {
  const card: Prisma.CardWhereInput = {}

  if (filters.code) card.code = filters.code
  if (filters.name) card.name = { contains: filters.name, mode: 'insensitive' }
  if (filters.search) {
    card.OR = [
      { code: { contains: filters.search, mode: 'insensitive' } },
      { name: { contains: filters.search, mode: 'insensitive' } },
    ]
  }
  const types = many(filters.type)
  if (types) card.type = { in: types }
  if (filters.counter !== undefined) card.counter = filters.counter

  const cost = range(filters.costMin, filters.costMax)
  if (cost) card.cost = cost
  const power = range(filters.powerMin, filters.powerMax)
  if (power) card.power = power
  if (filters.hasTrigger !== undefined) card.hasTrigger = filters.hasTrigger
  if (filters.blockIcon) card.blockIcon = filters.blockIcon
  /*
   * `some` com `in` e o "ou" dentro da faceta: a carta entra se **alguma** das
   * cores dela estiver entre as escolhidas. Um `AND` de varios `some` seria o
   * "e", que pediria a carta a ter todas — outra pergunta, e nao a que a tela
   * faz.
   */
  const colors = many(filters.color)
  if (colors) card.colors = { some: { color: { name: { in: colors } } } }
  const traits = many(filters.trait)
  if (traits) card.traits = { some: { trait: { name: { in: traits } } } }
  const attributes = many(filters.attribute)
  if (attributes) card.attributes = { some: { attribute: { name: { in: attributes } } } }
  const mechanics = many(filters.mechanic)
  if (mechanics) card.mechanics = { some: { mechanic: { name: { in: mechanics } } } }
  const effects = many(filters.effect)
  if (effects) card.effects = { some: { effect: { name: { in: effects } } } }

  const where: Prisma.CardVariantWhereInput = {}
  if (Object.keys(card).length > 0) where.card = card
  const rarities = many(filters.rarity)
  if (rarities) where.rarity = { in: rarities }
  const variantTypes = many(filters.variantType)
  if (variantTypes) where.variantType = { in: variantTypes }
  // O set vem sempre de variant_printings, nunca do prefixo do codigo.
  if (filters.setCode) where.printings = { some: { set: { code: filters.setCode } } }

  return where
}

/**
 * Ordena e pagina.
 *
 * ## Por que a ordenacao nao acontece no banco
 *
 * A ordem pedida e a de **lancamento**, que nao se deriva de nenhuma coluna: ela
 * intercala extra boosters entre boosters e vive numa lista no dominio. O
 * Prisma tambem nao sabe ordenar por campo de relacao muitos-para-muitos, e
 * `variant_printings` e uma.
 *
 * As alternativas eram reescrever a busca inteira em SQL bruto — com dezessete
 * filtros, cinco deles por tabela de junção — ou guardar a posicao numa coluna,
 * que passaria a envelhecer no dia em que a ordem mudasse.
 *
 * Em vez disso, a primeira consulta traz `id` e set de **todos** os resultados
 * do filtro, ordena em memoria e recorta a pagina; a segunda hidrata so essa
 * pagina. Nao e uma consulta a mais: o `count` que existia antes some, porque o
 * total passa a ser o tamanho da lista.
 *
 * O que isso custa: com 4.431 variantes, o pior caso traz 4.431 pares
 * (id, codigo do set) por requisicao. Sao dezenas de kilobytes e uma varredura
 * de indice. Se o catalogo crescer uma ordem de grandeza, isto precisa virar
 * ordenacao no banco — provavelmente com a posicao materializada em `sets`.
 */
export async function searchCatalog(
  prisma: PrismaClient,
  query: CatalogQuery = {},
): Promise<CatalogResult> {
  const page = Math.max(1, Math.trunc(query.page ?? 1))
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE)))
  const where = buildCatalogWhere(query)

  const matches = await prisma.cardVariant.findMany({
    where,
    select: {
      id: true,
      card: { select: { code: true } },
      printings: { select: { set: { select: { code: true } } }, take: 1 },
    },
  })

  matches.sort(byRelease)

  const total = matches.length
  const pageIds = matches.slice((page - 1) * pageSize, page * pageSize).map((row) => row.id)

  const rows = pageIds.length === 0
    ? []
    : await prisma.cardVariant.findMany({
      where: { id: { in: pageIds } },
      select: {
        id: true,
        sourceId: true,
        variantType: true,
        rarity: true,
        imageUrl: true,
        card: {
          select: {
            code: true,
            name: true,
            type: true,
            cost: true,
            power: true,
            counter: true,
            hasTrigger: true,
          },
        },
      },
    })

  /*
   * A pagina volta do banco em ordem qualquer: `IN (...)` nao preserva a ordem
   * da lista. Reordenar pelos ids ja ordenados e o que mantem a sequencia.
   */
  const position = new Map(pageIds.map((id, index) => [id, index]))
  rows.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0))

  return {
    items: rows.map((row) => ({
      variantId: row.id,
      sourceId: row.sourceId,
      cardCode: row.card.code,
      cardName: row.card.name,
      type: row.card.type,
      variantType: row.variantType,
      rarity: row.rarity,
      imageUrl: row.imageUrl,
      cost: row.card.cost,
      power: row.card.power,
      counter: row.card.counter,
      hasTrigger: row.card.hasTrigger,
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

interface Sortable {
  id: bigint
  card: { code: string }
  printings: { set: { code: string } }[]
}

/**
 * Ordem de exibicao: set por lancamento, depois codigo da carta, depois id.
 *
 * O desempate por id nao e zelo: sem ele, duas artes da mesma carta poderiam
 * trocar de lugar entre uma leva e a seguinte da rolagem, e a mesma carta
 * apareceria duas vezes ou nenhuma.
 *
 * Toda variante do catalogo tem exatamente uma impressao — foi conferido —, mas
 * o modelo permite mais de uma (decisao 006), entao a primeira e usada e a
 * ausencia e tratada em vez de presumida.
 */
function byRelease(a: Sortable, b: Sortable): number {
  const setDelta = compareSetsForCatalog(
    a.printings[0]?.set.code ?? null,
    b.printings[0]?.set.code ?? null,
  )
  if (setDelta !== 0) return setDelta

  if (a.card.code !== b.card.code) return a.card.code < b.card.code ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}
