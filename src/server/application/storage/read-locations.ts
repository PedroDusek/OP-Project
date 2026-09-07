import type { PrismaClient } from '@prisma/client'
import {
  PLAYSET_SIZE,
  isPlaysetClosed,
} from '@/server/domain/collection/counting'
import { compareSetsForCatalog } from '@/server/domain/catalog/sets'
import {
  describeLocation,
  type StoragePurpose,
  type StorageType,
} from '@/server/domain/storage/locations'
import { buildCatalogWhere, type CatalogFilters } from '@/server/application/catalog/search-cards'
import type { AuthenticatedUser } from '@/server/application/auth'

/**
 * Leitura do armazenamento (telas 21, 22 e 23).
 *
 * Camada: application.
 *
 * Toda consulta é escopada pelo dono (`where: { userId }`), e não conferida
 * depois (`architecture.md` 3.5). Um id de local que não é da pessoa não
 * devolve "acesso negado": devolve nada, que é o que ela de fato tem ali.
 */

export interface StorageLocationSummary {
  id: string
  name: string
  type: StorageType
  purpose: StoragePurpose | null
  image: string | null
  /** Subtítulo pronto: "Binder • Coleção". */
  subtitle: string
  /** Cópias guardadas aqui, somadas. */
  cardCount: number
}

export interface StorageLocationDetail extends StorageLocationSummary {
  description: string | null
  createdAt: Date
  updatedAt: Date
  /** Variantes distintas guardadas aqui. */
  uniqueVariants: number
  /**
   * Cartas com playset completo **dentro deste local**.
   *
   * Não é a contagem de playsets da coleção (`business-rules.md` 2.1), que é
   * por carta e sobre tudo o que a pessoa tem. Aqui a pergunta é outra e mais
   * física: quantas cartas estão inteiras neste binder. Uma carta com três
   * cópias aqui e uma na caixa fecha playset na coleção e não fecha aqui.
   */
  closedPlaysetsHere: number
}

export async function listStorageLocations(
  prisma: PrismaClient,
  user: AuthenticatedUser,
): Promise<StorageLocationSummary[]> {
  const rows = await prisma.storageLocation.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      type: true,
      purpose: true,
      image: true,
      locations: { select: { quantity: true } },
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })

  return rows.map((row) => toSummary(row))
}

export async function getStorageLocation(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  id: bigint,
): Promise<StorageLocationDetail | null> {
  const row = await prisma.storageLocation.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      purpose: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      locations: {
        select: {
          quantity: true,
          collectionItem: {
            select: { cardVariant: { select: { cardId: true, card: { select: { type: true } } } } },
          },
        },
      },
    },
  })
  if (!row) return null

  // Playset é por carta, e a mesma carta pode estar aqui em duas artes.
  const perCard = new Map<string, { type: string; quantity: number }>()
  for (const allocation of row.locations) {
    const card = allocation.collectionItem.cardVariant
    const key = String(card.cardId)
    const existing = perCard.get(key)
    if (existing) existing.quantity += allocation.quantity
    else perCard.set(key, { type: card.card.type, quantity: allocation.quantity })
  }

  let closedPlaysetsHere = 0
  for (const card of perCard.values()) {
    if (isPlaysetClosed(card.type, card.quantity)) closedPlaysetsHere += 1
  }

  return {
    ...toSummary(row),
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    uniqueVariants: row.locations.length,
    closedPlaysetsHere,
  }
}

export interface StoredCardView {
  variantId: string
  cardCode: string
  cardName: string
  rarity: string | null
  variantType: string
  imageUrl: string | null
  /** Cópias **neste local**, que é a pergunta da tela 23. */
  quantity: number
  /** Cópias da mesma variante que a pessoa possui ao todo. */
  ownedQuantity: number
  playsetHere: boolean
}

export interface StoredCardsQuery extends CatalogFilters {
  search?: string
}

/**
 * As cartas guardadas num local (tela 23).
 *
 * Sem paginação: um binder tem centenas de cartas, não milhares, e a tela
 * oferece busca e filtro. Se um dia um local passar da casa dos milhares, isto
 * vira o mesmo arranjo de rolagem infinita do catálogo — a ordenação já é a
 * mesma função.
 */
export async function listCardsInLocation(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  id: bigint,
  query: StoredCardsQuery = {},
): Promise<StoredCardView[]> {
  const location = await prisma.storageLocation.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  })
  if (!location) return []

  const rows = await prisma.collectionItemLocation.findMany({
    where: {
      storageLocationId: location.id,
      collectionItem: { cardVariant: buildCatalogWhere(query) },
    },
    select: {
      quantity: true,
      collectionItem: {
        select: {
          quantity: true,
          cardVariant: {
            select: {
              id: true,
              variantType: true,
              rarity: true,
              imageUrl: true,
              card: { select: { code: true, name: true, type: true } },
              printings: { select: { set: { select: { code: true } } }, take: 1 },
            },
          },
        },
      },
    },
  })

  const views = rows.map((row) => {
    const variant = row.collectionItem.cardVariant
    return {
      view: {
        variantId: String(variant.id),
        cardCode: variant.card.code,
        cardName: variant.card.name,
        rarity: variant.rarity,
        variantType: variant.variantType,
        imageUrl: variant.imageUrl,
        quantity: row.quantity,
        ownedQuantity: row.collectionItem.quantity,
        playsetHere: isPlaysetClosed(variant.card.type, row.quantity),
      } satisfies StoredCardView,
      setCode: variant.printings[0]?.set.code ?? null,
    }
  })

  views.sort((a, b) => {
    const set = compareSetsForCatalog(a.setCode, b.setCode)
    if (set !== 0) return set
    if (a.view.cardCode !== b.view.cardCode) return a.view.cardCode < b.view.cardCode ? -1 : 1
    return a.view.variantId < b.view.variantId ? -1 : a.view.variantId > b.view.variantId ? 1 : 0
  })

  return views.map(({ view }) => view)
}

interface SummaryRow {
  id: bigint
  name: string
  type: string
  purpose: string | null
  image: string | null
  locations: { quantity: number }[]
}

function toSummary(row: SummaryRow): StorageLocationSummary {
  const type = row.type as StorageType
  const purpose = row.purpose as StoragePurpose | null

  return {
    id: String(row.id),
    name: row.name,
    type,
    purpose,
    image: row.image,
    subtitle: describeLocation(type, purpose),
    cardCount: row.locations.reduce((sum, allocation) => sum + allocation.quantity, 0),
  }
}

export { PLAYSET_SIZE }
