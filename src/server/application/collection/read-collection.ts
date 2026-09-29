import type { Prisma, PrismaClient } from '@prisma/client'
import { DON_TYPE } from '@/server/domain/catalog/types'
import { countCollection, PLAYSET_SIZE, type OwnedVariant } from '@/server/domain/collection/counting'
import {
  compareCatalogOrder,
  compareCatalogSort,
  DEFAULT_CATALOG_SORT,
  placementSet,
  type CatalogSort,
} from '@/server/domain/catalog/order'
import { buildCatalogWhere, type CatalogFilters } from '@/server/application/catalog/search-cards'
import type { AuthenticatedUser } from '@/server/application/auth'
import { assertPremium, isPremium } from '@/server/application/authorization'

/**
 * Leitura da colecao.
 *
 * Camada: application.
 *
 * O filtro reusa `buildCatalogWhere`: filtrar a colecao por cor, raridade ou
 * set e a mesma pergunta que filtrar o catalogo, feita sobre um subconjunto.
 * Duplicar essa construcao daria dois lugares para as duas divergirem.
 *
 * A ordem e a mesma do catalogo — lancamento, promos no fim — pelo mesmo motivo
 * de la, e para a colecao nao parecer outro produto.
 */

export interface CollectionItemView {
  variantId: bigint
  cardCode: string
  cardName: string
  cardType: string
  variantType: string
  rarity: string | null
  imageUrl: string | null
  quantity: number
  /** Copias somadas de **todas** as variantes desta carta. */
  quantityForCard: number
  playsetClosed: boolean
}

export interface CollectionPage {
  items: CollectionItemView[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface CollectionSummary {
  totalCards: number
  uniqueVariants: number
  closedPlaysets: number
  /** Quantos DON!! diferentes a pessoa tem (decisao 112). Fora do progresso. */
  donVariants: number
  /** Variantes distintas do catalogo, para o progresso. **Sem DON!!**. */
  catalogVariants: number
}

const DEFAULT_PAGE_SIZE = 24
const MAX_PAGE_SIZE = 100

/** Só o que a pessoa possui, dentro do filtro pedido. */
function ownedWhere(collectionId: bigint, filters: CatalogFilters): Prisma.CardVariantWhereInput {
  return {
    ...buildCatalogWhere(filters),
    collectionItems: { some: { collectionId, quantity: { gt: 0 } } },
  }
}

async function collectionIdOf(prisma: PrismaClient, user: AuthenticatedUser): Promise<bigint | null> {
  const collection = await prisma.collection.findUnique({
    where: { userId: user.id },
    select: { id: true },
  })
  return collection?.id ?? null
}

/**
 * Os numeros do topo da colecao e da Home.
 *
 * A contagem inteira e feita no dominio (`countCollection`), sobre a lista de
 * itens possuidos. Uma colecao grande e alguns milhares de linhas de tres
 * campos; agregar em SQL exigiria repetir a regra de playset — que e binaria
 * por carta e exclui Leader — numa linguagem onde ela e bem mais facil de
 * escrever errado.
 */
export async function getCollectionSummary(
  prisma: PrismaClient,
  user: AuthenticatedUser,
): Promise<CollectionSummary> {
  const collectionId = await collectionIdOf(prisma, user)
  /*
   * O denominador do progresso **exclui DON!!** (decisao 112). Sem isto, os 239
   * DON!! entrariam no total do catalogo e o progresso de todo mundo cairia da
   * noite para o dia por uma carta que nem entra em deck — e o dono do produto
   * pediu justamente que o DON!! nao tivesse progresso.
   *
   * O numerador (`uniqueVariants`) exclui pelo mesmo motivo, em `countCollection`.
   */
  const catalogVariants = await prisma.cardVariant.count({
    where: { card: { type: { not: DON_TYPE } } },
  })

  if (!collectionId) {
    return { totalCards: 0, uniqueVariants: 0, closedPlaysets: 0, donVariants: 0, catalogVariants }
  }

  const items = await prisma.collectionItem.findMany({
    where: { collectionId, quantity: { gt: 0 } },
    select: {
      quantity: true,
      cardVariantId: true,
      cardVariant: { select: { cardId: true, card: { select: { type: true } } } },
    },
  })

  const totals = countCollection(
    items.map(
      (item): OwnedVariant => ({
        cardId: String(item.cardVariant.cardId),
        cardType: item.cardVariant.card.type,
        variantId: String(item.cardVariantId),
        quantity: item.quantity,
      }),
    ),
  )

  return { ...totals, catalogVariants }
}

export interface CollectionQuery extends CatalogFilters {
  page?: number
  pageSize?: number
  /** `playsets` traz só cartas fechadas; `incomplete`, só as que faltam. */
  scope?: 'all' | 'playsets' | 'incomplete'
  /** A ordem escolhida, a mesma do catálogo (decisão 110). */
  sort?: CatalogSort
}

/** O que só existe para ordenar, e que a tela não recebe. */
interface SortFields {
  setCode: string | null
  sourceId: string | null
  cost: number | null
  power: number | null
}

export async function searchCollection(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  query: CollectionQuery = {},
): Promise<CollectionPage> {
  const page = Math.max(1, Math.trunc(query.page ?? 1))
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE)),
  )

  const collectionId = await collectionIdOf(prisma, user)
  if (!collectionId) {
    return { items: [], page, pageSize, total: 0, totalPages: 1 }
  }

  const matches = await prisma.cardVariant.findMany({
    where: ownedWhere(collectionId, query),
    select: {
      id: true,
      cardId: true,
      sourceId: true,
      variantType: true,
      rarity: true,
      imageUrl: true,
      // `cost` e `power` vêm só para ordenar; a tela não os mostra.
      card: { select: { code: true, name: true, type: true, cost: true, power: true } },
      printings: { select: { set: { select: { code: true } } } },
      collectionItems: { where: { collectionId }, select: { quantity: true } },
    },
  })

  /*
   * O playset e por carta, e a carta pode ter variantes fora do filtro atual —
   * filtrar por "Parallel" nao pode fazer um playset fechado parecer aberto.
   * Por isso a soma por carta vem da colecao inteira, e nao do recorte.
   */
  const perCard = await quantityPerCard(prisma, collectionId)

  const views = matches.map((row): CollectionItemView & SortFields => {
    const quantity = row.collectionItems[0]?.quantity ?? 0
    const quantityForCard = perCard.get(String(row.cardId)) ?? quantity

    return {
      variantId: row.id,
      cardCode: row.card.code,
      cardName: row.card.name,
      cardType: row.card.type,
      variantType: row.variantType,
      rarity: row.rarity,
      imageUrl: row.imageUrl,
      quantity,
      quantityForCard,
      playsetClosed: row.card.type !== 'Leader' && quantityForCard >= PLAYSET_SIZE,
      // Os tres ultimos existem so para ordenar (decisoes 069 e 110).
      setCode: placementSet(row.card.code, row.printings.map((p) => p.set.code), query.setCode),
      sourceId: row.sourceId,
      cost: row.card.cost,
      power: row.card.power,
    }
  })

  const scoped =
    query.scope === 'playsets'
      ? views.filter((view) => view.playsetClosed)
      : query.scope === 'incomplete'
        ? views.filter((view) => !view.playsetClosed && view.cardType !== 'Leader')
        : views

  /*
   * A mesma cadeia do catálogo: a ordem escolhida primeiro, a do catálogo como
   * desempate, o id por último. A coleção e o catálogo mostram as mesmas
   * cartas — ordenar diferente nas duas telas seria a mesma escolha dando dois
   * resultados.
   */
  const sort = query.sort ?? DEFAULT_CATALOG_SORT
  scoped.sort(
    (a, b) =>
      compareCatalogSort(a, b, sort) ||
      compareCatalogOrder(a, b) ||
      (a.variantId < b.variantId ? -1 : a.variantId > b.variantId ? 1 : 0),
  )

  const total = scoped.length
  // `setCode` e `sourceId` existem so para ordenar; nao fazem parte do que a tela recebe.
  const items = scoped.slice((page - 1) * pageSize, page * pageSize).map((view) => {
    const { setCode, sourceId, cost, power, ...rest } = view
    void setCode
    void sourceId
    void cost
    void power
    return rest
  })

  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

/** Copias somadas por carta, em toda a colecao. */
async function quantityPerCard(
  prisma: PrismaClient,
  collectionId: bigint,
): Promise<Map<string, number>> {
  const rows = await prisma.collectionItem.findMany({
    where: { collectionId, quantity: { gt: 0 } },
    select: { quantity: true, cardVariant: { select: { cardId: true } } },
  })

  const perCard = new Map<string, number>()
  for (const row of rows) {
    const key = String(row.cardVariant.cardId)
    perCard.set(key, (perCard.get(key) ?? 0) + row.quantity)
  }
  return perCard
}

export interface PlaysetRow {
  cardCode: string
  cardName: string
  cardType: string
  imageUrl: string | null
  quantity: number
  closed: boolean
}

/**
 * Playsets, por **codigo de carta**.
 *
 * A tela 19 lista cartas, e nao variantes: e a carta que fecha ou nao fecha um
 * playset. `Leader` fica de fora inteiro, porque nunca conta.
 */
export async function listPlaysets(
  prisma: PrismaClient,
  user: AuthenticatedUser,
): Promise<PlaysetRow[]> {
  // Decisao 093: a analise da colecao e Premium. A tela ja esconde o caminho;
  // isto recusa quem monta o endereco a mao.
  assertPremium(user, 'A lista de playsets é um recurso Premium.')

  const collectionId = await collectionIdOf(prisma, user)
  if (!collectionId) return []

  const rows = await prisma.collectionItem.findMany({
    where: { collectionId, quantity: { gt: 0 }, cardVariant: { card: { type: { not: 'Leader' } } } },
    select: {
      quantity: true,
      cardVariant: {
        select: {
          imageUrl: true,
          card: { select: { id: true, code: true, name: true, type: true } },
        },
      },
    },
  })

  const perCard = new Map<string, PlaysetRow>()
  for (const row of rows) {
    const card = row.cardVariant.card
    const key = String(card.id)
    const existing = perCard.get(key)

    if (existing) {
      existing.quantity += row.quantity
      existing.imageUrl ??= row.cardVariant.imageUrl
    } else {
      perCard.set(key, {
        cardCode: card.code,
        cardName: card.name,
        cardType: card.type,
        imageUrl: row.cardVariant.imageUrl,
        quantity: row.quantity,
        closed: false,
      })
    }
  }

  const playsets = [...perCard.values()].map((row) => ({
    ...row,
    closed: row.quantity >= PLAYSET_SIZE,
  }))

  playsets.sort((a, b) => (a.cardCode < b.cardCode ? -1 : a.cardCode > b.cardCode ? 1 : 0))
  return playsets
}

export interface Dashboard {
  /** Quantas cartas a pessoa tem. É o único número que o Free vê (decisão 093). */
  totalCards: number
  premium: boolean
  /** Do Premium para baixo, `null`: a tela mostra o aviso no lugar do número. */
  uniqueVariants: number | null
  closedPlaysets: number | null
  catalogVariants: number | null
}

/**
 * O Início (decisão 093).
 *
 * A análise da coleção — variantes distintas, playsets fechados, progresso do
 * catálogo e, quando existir, o valor estimado — é recurso Premium. O total de
 * cartas fica para todos: sem ele, quem acabou de cadastrar cinquenta cartas
 * abriria o app e não veria sinal nenhum do próprio trabalho.
 *
 * Para o Free, a consulta é uma soma no banco, e não a leitura de toda a
 * coleção: gatear na tela e continuar carregando o que não vai aparecer seria
 * pagar o custo do recurso sem entregá-lo.
 */
export async function readDashboard(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  now = new Date(),
): Promise<Dashboard> {
  if (isPremium(user, now)) {
    const summary = await getCollectionSummary(prisma, user)
    return { ...summary, premium: true }
  }

  const collectionId = await collectionIdOf(prisma, user)
  if (!collectionId) {
    return { totalCards: 0, premium: false, uniqueVariants: null, closedPlaysets: null, catalogVariants: null }
  }

  const soma = await prisma.collectionItem.aggregate({
    where: { collectionId, quantity: { gt: 0 } },
    _sum: { quantity: true },
  })

  return {
    totalCards: soma._sum.quantity ?? 0,
    premium: false,
    uniqueVariants: null,
    closedPlaysets: null,
    catalogVariants: null,
  }
}
