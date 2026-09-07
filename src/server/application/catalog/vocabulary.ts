import type { PrismaClient } from '@prisma/client'

/**
 * O vocabulario que o painel de filtros oferece.
 *
 * Camada: application.
 *
 * Sai do catalogo importado, e nao de uma lista escrita a mao. Uma constante no
 * codigo divergiria da fonte na primeira coletanea nova — e o sintoma seria um
 * filtro que devolve zero resultado sem explicar por que.
 *
 * Isso tambem faz o painel refletir as decisoes ja tomadas sem repeti-las:
 * `variantTypes` traz apenas Normal e Parallel (decisao 023), `mechanics` traz
 * so os dez termos da allowlist (decisao 022), e `effects` nao aparece porque a
 * tabela esta vazia de proposito (decisao 021).
 */

export interface CatalogVocabulary {
  types: string[]
  rarities: string[]
  variantTypes: string[]
  colors: string[]
  attributes: string[]
  mechanics: string[]
  /** 171 termos: quantidade demais para chips, entra como busca. */
  traits: string[]
  costRange: { min: number; max: number } | null
  powerRange: { min: number; max: number } | null
}

/**
 * A ordem das raridades e a do jogo, do mais comum ao mais raro, e nao
 * alfabetica: numa fileira de chips, `C, L, P, R, SEC, SP CARD, SR, TR, UC`
 * nao diz nada a quem procura as raras.
 *
 * O que nao estiver aqui vai para o fim, na ordem em que veio. Assim uma
 * raridade nova aparece no painel em vez de sumir por nao ter sido prevista.
 */
const RARITY_ORDER = ['C', 'UC', 'R', 'SR', 'SEC', 'L', 'P', 'SP CARD', 'TR']

function byKnownOrder(order: string[]) {
  return (a: string, b: string) => {
    const indexA = order.indexOf(a)
    const indexB = order.indexOf(b)
    if (indexA === -1 && indexB === -1) return a.localeCompare(b)
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexA - indexB
  }
}

export async function getCatalogVocabulary(prisma: PrismaClient): Promise<CatalogVocabulary> {
  const [types, rarities, variantTypes, colors, attributes, mechanics, traits, ranges] =
    await Promise.all([
      prisma.card.findMany({ distinct: ['type'], select: { type: true }, orderBy: { type: 'asc' } }),
      prisma.cardVariant.findMany({
        distinct: ['rarity'],
        select: { rarity: true },
        where: { rarity: { not: null } },
      }),
      prisma.cardVariant.findMany({
        distinct: ['variantType'],
        select: { variantType: true },
        orderBy: { variantType: 'asc' },
      }),
      prisma.color.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
      prisma.attribute.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
      prisma.mechanic.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
      prisma.trait.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
      prisma.card.aggregate({
        _min: { cost: true, power: true },
        _max: { cost: true, power: true },
      }),
    ])

  return {
    types: types.map((row) => row.type),
    rarities: rarities
      .map((row) => row.rarity)
      .filter((rarity): rarity is string => rarity !== null)
      .sort(byKnownOrder(RARITY_ORDER)),
    variantTypes: variantTypes.map((row) => row.variantType),
    colors: colors.map((row) => row.name),
    attributes: attributes.map((row) => row.name),
    mechanics: mechanics.map((row) => row.name),
    traits: traits.map((row) => row.name),
    costRange:
      ranges._min.cost !== null && ranges._max.cost !== null
        ? { min: ranges._min.cost, max: ranges._max.cost }
        : null,
    powerRange:
      ranges._min.power !== null && ranges._max.power !== null
        ? { min: ranges._min.power, max: ranges._max.power }
        : null,
  }
}
