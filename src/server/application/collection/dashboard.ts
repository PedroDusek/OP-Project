import type { PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { assertPremium } from '@/server/application/authorization'
import { listSets } from '@/server/application/catalog/list-sets'
import { getUsdBrlRate } from '@/server/application/prices/read-prices'
import {
  buildDashboard,
  type Dashboard,
  type DashboardFilters,
  type DashboardSet,
  type DashboardVariant,
} from '@/server/domain/collection/dashboard'

/**
 * O dashboard da coleção (decisão 098).
 *
 * Camada: application. Junta o catálogo, o que a pessoa tem e os preços, e
 * entrega ao domínio, que faz as contas.
 *
 * Recurso Premium, como o resto da análise da coleção (decisão 093).
 */

export interface DashboardFilterInput {
  /** Código da coleção, como vai na URL (`OP-01`). */
  setCode?: string
  rarities?: string[]
  colors?: string[]
}

export interface CollectionDashboard extends Dashboard {
  /**
   * O valor da coleção inteira, sem filtro: é o número do topo do Início, que
   * não muda quando a pessoa recorta os gráficos de baixo.
   */
  overallValueUsd: number
  /** Cotação do dólar, quando há uma utilizável: a tela mostra em real. */
  rate: number | null
  /** As coleções que o filtro oferece, na ordem de lançamento. */
  sets: DashboardSet[]
}

export async function readCollectionDashboard(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  filterInput: DashboardFilterInput = {},
  now: Date = new Date(),
): Promise<CollectionDashboard> {
  assertPremium(user, 'O dashboard da coleção é um recurso Premium.', now)

  const [sets, variants, owned, prices, rate] = await Promise.all([
    colecoes(prisma),
    variantes(prisma),
    posse(prisma, user),
    precos(prisma),
    getUsdBrlRate(prisma, now),
  ])

  const setId = filterInput.setCode ? sets.find((set) => set.code === filterInput.setCode)?.id : undefined
  const filters: DashboardFilters = {
    // Codigo que nao existe e filtro nenhum, e nao uma tela vazia.
    setId,
    rarities: filterInput.rarities?.length ? filterInput.rarities : undefined,
    colors: filterInput.colors?.length ? filterInput.colors : undefined,
  }

  const recortado = buildDashboard({ sets, variants, owned, prices, filters })
  const semFiltro = filters.setId || filters.rarities || filters.colors
    ? buildDashboard({ sets, variants, owned, prices, filters: {} })
    : recortado

  return {
    ...recortado,
    overallValueUsd: semFiltro.totalValueUsd,
    rate: rate?.rate ?? null,
    sets,
  }
}

/** As coleções, com o nome de exibição e a ordem de lançamento de `listSets`. */
async function colecoes(prisma: PrismaClient): Promise<DashboardSet[]> {
  const [resumos, ids] = await Promise.all([
    listSets(prisma),
    prisma.set.findMany({ select: { id: true, code: true } }),
  ])
  const idPorCodigo = new Map(ids.map((set) => [set.code, String(set.id)]))
  return resumos
    .filter((set) => idPorCodigo.has(set.code))
    .map((set) => ({
      id: idPorCodigo.get(set.code)!,
      code: set.code,
      displayCode: set.displayCode,
      displayName: set.displayName,
      coverUrl: set.coverUrl,
    }))
}

async function variantes(prisma: PrismaClient): Promise<DashboardVariant[]> {
  const linhas = await prisma.cardVariant.findMany({
    select: {
      id: true,
      rarity: true,
      variantType: true,
      imageUrl: true,
      printings: { select: { setId: true } },
      card: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          colors: { select: { color: { select: { name: true } } } },
        },
      },
    },
  })

  return linhas.map((linha) => ({
    id: String(linha.id),
    cardId: String(linha.card.id),
    cardCode: linha.card.code,
    cardName: linha.card.name,
    cardType: linha.card.type,
    rarity: linha.rarity,
    variantType: linha.variantType,
    colors: linha.card.colors.map((c) => c.color.name),
    imageUrl: linha.imageUrl,
    setIds: linha.printings.map((p) => String(p.setId)),
  }))
}

async function posse(prisma: PrismaClient, user: AuthenticatedUser): Promise<Map<string, number>> {
  const itens = await prisma.collectionItem.findMany({
    where: { collection: { userId: user.id }, quantity: { gt: 0 } },
    select: { cardVariantId: true, quantity: true },
  })
  return new Map(itens.map((item) => [String(item.cardVariantId), item.quantity]))
}

/**
 * O preço de cada variante, numa consulta só: uma por variante seriam milhares
 * de idas ao banco.
 *
 * Era um `DISTINCT ON` sobre a série histórica. Desde a decisão 107 há **uma
 * linha por variante**, e desempatar por data deixou de fazer sentido.
 */
async function precos(prisma: PrismaClient): Promise<Map<string, number>> {
  const linhas = await prisma.cardPrice.findMany({ select: { cardVariantId: true, value: true } })
  return new Map(linhas.map((linha) => [String(linha.cardVariantId), Number(linha.value)]))
}
