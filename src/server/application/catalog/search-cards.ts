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
  cost?: number
  power?: number
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

export function buildCatalogWhere(filters: CatalogFilters): Prisma.CardVariantWhereInput {
  const card: Prisma.CardWhereInput = {}

  if (filters.code) card.code = filters.code
  if (filters.name) card.name = { contains: filters.name, mode: 'insensitive' }
  if (filters.type) card.type = filters.type
  if (filters.cost !== undefined) card.cost = filters.cost
  if (filters.power !== undefined) card.power = filters.power
  if (filters.counter !== undefined) card.counter = filters.counter
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
