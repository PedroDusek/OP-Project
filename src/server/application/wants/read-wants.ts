import type { PrismaClient } from '@prisma/client'
import { compareSetsForCatalog } from '@/server/domain/catalog/sets'
import { remainingToGet, wantStatus, type WantStatus } from '@/server/domain/wants/status'
import { sourceImageUrl } from '@/server/domain/prices/source-image'
import { buildCatalogWhere, type CatalogFilters } from '@/server/application/catalog/search-cards'
import type { AuthenticatedUser } from '@/server/application/auth'

/**
 * Leitura da want list (tela 29).
 *
 * Camada: application.
 *
 * O filtro reusa `buildCatalogWhere` pelo mesmo motivo da coleção: filtrar a
 * want list por cor ou raridade é a mesma pergunta feita sobre um subconjunto,
 * e duplicar a construção daria dois lugares para as duas divergirem.
 *
 * A ordem também é a mesma — lançamento, promos no fim (decisão 040). Quem
 * organiza uma want list percorre por set como em todo o resto do produto.
 */

export interface WantView {
  variantId: string
  cardCode: string
  cardName: string
  rarity: string | null
  variantType: string
  imageUrl: string | null
  /**
   * A mesma carta na fonte de preco, ou nulo quando nao ha vinculo.
   *
   * Existe por um motivo so: e a unica imagem que o navegador consegue desenhar
   * num `canvas` para exportar (decisao 058). Na tela quem vale e `imageUrl`.
   */
  sheetImageUrl: string | null
  /** Quantas a pessoa quer. */
  wanted: number
  /** Quantas ela já tem desta variante. */
  owned: number
  /** Quantas ainda faltam. */
  remaining: number
  status: WantStatus
}

export interface WantSummary {
  /** Variantes na lista. */
  variants: number
  /** Cópias que ainda faltam, somadas. */
  remaining: number
  /** Wants já satisfeitos, que continuam na lista até serem tirados. */
  satisfied: number
}

/**
 * As quantidades possuídas das variantes pedidas, num mapa.
 *
 * Uma consulta só, e não uma por want: a lista tem dezenas de itens, e o N+1
 * aqui seria silencioso — funciona em desenvolvimento com três wants e some
 * na conta de quem tem trezentos.
 */
async function ownedByVariant(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  variantIds: bigint[],
): Promise<Map<string, number>> {
  if (variantIds.length === 0) return new Map()

  const items = await prisma.collectionItem.findMany({
    where: { collection: { userId: user.id }, cardVariantId: { in: variantIds } },
    select: { cardVariantId: true, quantity: true },
  })

  return new Map(items.map((item) => [String(item.cardVariantId), item.quantity]))
}

export interface WantQuery extends CatalogFilters {
  /** `missing` esconde o que já foi conseguido. */
  scope?: 'all' | 'missing'
}

export async function listWants(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  query: WantQuery = {},
): Promise<WantView[]> {
  const wants = await prisma.wantItem.findMany({
    where: { userId: user.id, cardVariant: buildCatalogWhere(query) },
    select: {
      quantity: true,
      cardVariant: {
        select: {
          id: true,
          variantType: true,
          rarity: true,
          imageUrl: true,
          card: { select: { code: true, name: true } },
          printings: { select: { set: { select: { code: true } } }, take: 1 },
          // O vinculo com a fonte de preco, que e a unica imagem que autoriza
          // leitura cruzada e por isso serve para desenhar a folha (decisao
          // 058). So o numero do produto: a imagem nunca entra no nosso banco.
          sourceProducts: { select: { sourceProductId: true }, take: 1 },
        },
      },
    },
  })

  const owned = await ownedByVariant(
    prisma,
    user,
    wants.map((want) => want.cardVariant.id),
  )

  const views = wants.map((want) => {
    const variant = want.cardVariant
    const have = owned.get(String(variant.id)) ?? 0

    return {
      view: {
        variantId: String(variant.id),
        cardCode: variant.card.code,
        cardName: variant.card.name,
        rarity: variant.rarity,
        variantType: variant.variantType,
        imageUrl: variant.imageUrl,
        sheetImageUrl: variant.sourceProducts[0]
          ? sourceImageUrl(variant.sourceProducts[0].sourceProductId)
          : null,
        wanted: want.quantity,
        owned: have,
        remaining: remainingToGet(have, want.quantity),
        status: wantStatus(have, want.quantity),
      } satisfies WantView,
      setCode: variant.printings[0]?.set.code ?? null,
    }
  })

  const scoped =
    query.scope === 'missing' ? views.filter((row) => row.view.status !== 'satisfied') : views

  scoped.sort((a, b) => {
    const set = compareSetsForCatalog(a.setCode, b.setCode)
    if (set !== 0) return set
    if (a.view.cardCode !== b.view.cardCode) return a.view.cardCode < b.view.cardCode ? -1 : 1
    return a.view.variantId < b.view.variantId ? -1 : a.view.variantId > b.view.variantId ? 1 : 0
  })

  return scoped.map(({ view }) => view)
}

/** Os números do topo da lista e da aba. */
export async function getWantSummary(
  prisma: PrismaClient,
  user: AuthenticatedUser,
): Promise<WantSummary> {
  const wants = await prisma.wantItem.findMany({
    where: { userId: user.id },
    select: { quantity: true, cardVariantId: true },
  })

  const owned = await ownedByVariant(
    prisma,
    user,
    wants.map((want) => want.cardVariantId),
  )

  let remaining = 0
  let satisfied = 0

  for (const want of wants) {
    const have = owned.get(String(want.cardVariantId)) ?? 0
    remaining += remainingToGet(have, want.quantity)
    if (wantStatus(have, want.quantity) === 'satisfied') satisfied += 1
  }

  return { variants: wants.length, remaining, satisfied }
}

/** Quantas a pessoa quer desta variante. Zero quando não está na lista. */
export async function getWantQuantity(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  cardVariantId: bigint,
): Promise<number> {
  const want = await prisma.wantItem.findFirst({
    where: { userId: user.id, cardVariantId },
    select: { quantity: true },
  })
  return want?.quantity ?? 0
}
