import type { Prisma, PrismaClient } from '@prisma/client'
import type { CardType } from '@/server/domain/catalog/types'

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
  type?: CardType
  color?: string
  trait?: string
  attribute?: string
  mechanic?: string
  effect?: string
  rarity?: string
  variantType?: string
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
  if (filters.type) card.type = filters.type
  if (filters.counter !== undefined) card.counter = filters.counter

  const cost = range(filters.costMin, filters.costMax)
  if (cost) card.cost = cost
  const power = range(filters.powerMin, filters.powerMax)
  if (power) card.power = power
  if (filters.hasTrigger !== undefined) card.hasTrigger = filters.hasTrigger
  if (filters.blockIcon) card.blockIcon = filters.blockIcon
  if (filters.color) card.colors = { some: { color: { name: filters.color } } }
  if (filters.trait) card.traits = { some: { trait: { name: filters.trait } } }
  if (filters.attribute) card.attributes = { some: { attribute: { name: filters.attribute } } }
  if (filters.mechanic) card.mechanics = { some: { mechanic: { name: filters.mechanic } } }
  if (filters.effect) card.effects = { some: { effect: { name: filters.effect } } }

  const where: Prisma.CardVariantWhereInput = {}
  if (Object.keys(card).length > 0) where.card = card
  if (filters.rarity) where.rarity = filters.rarity
  if (filters.variantType) where.variantType = filters.variantType
  // O set vem sempre de variant_printings, nunca do prefixo do codigo.
  if (filters.setCode) where.printings = { some: { set: { code: filters.setCode } } }

  return where
}

export async function searchCatalog(
  prisma: PrismaClient,
  query: CatalogQuery = {},
): Promise<CatalogResult> {
  const page = Math.max(1, Math.trunc(query.page ?? 1))
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE)))
  const where = buildCatalogWhere(query)

  const [total, rows] = await Promise.all([
    prisma.cardVariant.count({ where }),
    prisma.cardVariant.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      // Ordem deterministica: sem o desempate por id, duas artes da mesma carta
      // poderiam trocar de lugar entre paginas.
      orderBy: [{ card: { code: 'asc' } }, { id: 'asc' }],
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
    }),
  ])

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
