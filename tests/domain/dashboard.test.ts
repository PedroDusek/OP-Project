import { describe, expect, it } from 'vitest'
import { buildDashboard, type DashboardSet, type DashboardVariant } from '@/server/domain/collection/dashboard'

/**
 * O dashboard da coleção (decisão 098), com as contas definidas pelo dono do
 * produto: variante por coleção, playset pela carta inteira, valor por coleção
 * como ótica e total contado uma vez.
 */

const OP01: DashboardSet = { id: 's1', code: 'OP-01', displayCode: 'OP01', displayName: 'Romance Dawn', coverUrl: null }
const OP02: DashboardSet = { id: 's2', code: 'OP-02', displayCode: 'OP02', displayName: 'Paramount War', coverUrl: null }
const PROMO: DashboardSet = { id: 's3', code: 'P', displayCode: 'P', displayName: 'Promo', coverUrl: null }

function variante(
  id: string,
  cardId: string,
  setIds: string[],
  extra: Partial<DashboardVariant> = {},
): DashboardVariant {
  return {
    id,
    cardId,
    cardCode: `C-${cardId}`,
    cardName: `Carta ${cardId}`,
    cardType: 'Character',
    rarity: 'C',
    variantType: 'Normal',
    colors: ['Red'],
    imageUrl: null,
    setIds,
    ...extra,
  }
}

const base = (variants: DashboardVariant[], owned: Record<string, number>, prices: Record<string, number> = {}) => ({
  sets: [OP01, OP02, PROMO],
  variants,
  owned: new Map(Object.entries(owned)),
  prices: new Map(Object.entries(prices)),
  filters: {},
})

describe('progresso por coleção', () => {
  it('duas artes da mesma carta na mesma coleção são duas variantes, e um playset só', () => {
    const variants = [
      variante('v1', 'c1', ['s1']),
      variante('v2', 'c1', ['s1'], { variantType: 'Parallel' }),
      variante('v3', 'c2', ['s1']),
    ]
    const dash = buildDashboard(base(variants, { v1: 3, v2: 1 }))

    expect(dash.bySet).toEqual([
      expect.objectContaining({ variantsOwned: 2, variantsTotal: 3, playsetsClosed: 1, playsetsTotal: 2 }),
    ])
  })

  it('as cópias de outra coleção contam para o playset — a carta é uma só', () => {
    const variants = [variante('v1', 'c1', ['s1']), variante('v2', 'c1', ['s3'], { variantType: 'Parallel' })]
    const dash = buildDashboard(base(variants, { v1: 2, v2: 2 }))

    const op01 = dash.bySet.find((s) => s.set.id === 's1')!
    expect(op01).toMatchObject({ variantsOwned: 1, variantsTotal: 1, playsetsClosed: 1, playsetsTotal: 1 })
  })

  it('Leader nunca conta playset', () => {
    const dash = buildDashboard(base([variante('v1', 'c1', ['s1'], { cardType: 'Leader' })], { v1: 4 }))
    expect(dash.bySet[0]).toMatchObject({ playsetsClosed: 0, playsetsTotal: 0, variantsOwned: 1 })
  })

  it('só aparecem as coleções de que a pessoa tem alguma carta, na ordem de lançamento', () => {
    const variants = [variante('v1', 'c1', ['s2']), variante('v2', 'c2', ['s1']), variante('v3', 'c3', ['s3'])]
    const dash = buildDashboard(base(variants, { v1: 1, v2: 1 }))
    expect(dash.bySet.map((s) => s.set.id)).toEqual(['s1', 's2'])
  })
})

describe('o valor', () => {
  it('a arte impressa em duas coleções vale nas duas, e o total conta uma vez', () => {
    const variants = [variante('v1', 'c1', ['s1', 's3'])]
    const dash = buildDashboard(base(variants, { v1: 2 }, { v1: 10 }))

    expect(dash.bySet.map((s) => s.valueUsd)).toEqual([20, 20])
    expect(dash.totalValueUsd).toBe(20)
  })

  it('cópia sem preço fica fora do valor, e é contada', () => {
    const variants = [variante('v1', 'c1', ['s1']), variante('v2', 'c2', ['s1'])]
    const dash = buildDashboard(base(variants, { v1: 1, v2: 3 }, { v1: 5 }))
    expect(dash.totalValueUsd).toBe(5)
    expect(dash.copiesWithoutPrice).toBe(3)
    expect(dash.totalCopies).toBe(4)
  })

  it('as mais caras, pelo preço de uma cópia', () => {
    const variants = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => variante(id, `c${id}`, ['s1']))
    const precos = { a: 1, b: 50, c: 3, d: 20, e: 7, f: 0.5 }
    const dash = buildDashboard(base(variants, { a: 1, b: 1, c: 4, d: 1, e: 1, f: 1 }, precos))
    expect(dash.mostValuable.map((c) => c.variantId)).toEqual(['b', 'd', 'e', 'c', 'a'])
  })
})

describe('o custo para completar', () => {
  it('uma cópia de cada variante que falta, e as sem preço contadas à parte', () => {
    const variants = [variante('v1', 'c1', ['s1']), variante('v2', 'c2', ['s1']), variante('v3', 'c3', ['s1'])]
    const dash = buildDashboard(base(variants, { v1: 1 }, { v1: 100, v2: 4.5 }))

    expect(dash.bySet[0]).toMatchObject({ completeUsd: 4.5, missingWithoutPrice: 1 })
    expect(dash.completeUsd).toBe(4.5)
  })

  it('no recorte todo, a variante que falta em duas coleções conta uma vez', () => {
    const variants = [variante('v1', 'c1', ['s1']), variante('v2', 'c2', ['s1', 's3'])]
    const dash = buildDashboard(base(variants, { v1: 1 }, { v2: 8 }))
    expect(dash.completeUsd).toBe(8)
  })
})

describe('a distribuição', () => {
  it('por raridade, cor e tipo, com cópias e valor; carta de duas cores entra nas duas', () => {
    const variants = [
      variante('v1', 'c1', ['s1'], { rarity: 'SR', colors: ['Red', 'Green'] }),
      variante('v2', 'c2', ['s1'], { rarity: 'C', cardType: 'Event' }),
    ]
    const dash = buildDashboard(base(variants, { v1: 1, v2: 2 }, { v1: 10, v2: 1 }))

    expect(dash.byRarity).toEqual([
      { label: 'SR', copies: 1, valueUsd: 10 },
      { label: 'C', copies: 2, valueUsd: 2 },
    ])
    expect(dash.byColor).toEqual(
      expect.arrayContaining([
        { label: 'Red', copies: 3, valueUsd: 12 },
        { label: 'Green', copies: 1, valueUsd: 10 },
      ]),
    )
    expect(dash.byType).toEqual([
      { label: 'Character', copies: 1, valueUsd: 10 },
      { label: 'Event', copies: 2, valueUsd: 2 },
    ])
  })
})

describe('os filtros recortam tudo', () => {
  const variants = [
    variante('v1', 'c1', ['s1'], { rarity: 'SR', colors: ['Red'] }),
    variante('v2', 'c2', ['s1'], { rarity: 'C', colors: ['Blue'] }),
    variante('v3', 'c3', ['s2'], { rarity: 'SR', colors: ['Blue'] }),
  ]
  const owned = { v1: 1, v2: 1, v3: 1 }
  const precos = { v1: 10, v2: 1, v3: 5 }

  it('por coleção', () => {
    const dash = buildDashboard({ ...base(variants, owned, precos), filters: { setId: 's2' } })
    expect(dash.bySet.map((s) => s.set.id)).toEqual(['s2'])
    expect(dash.totalValueUsd).toBe(5)
  })

  it('por raridade', () => {
    const dash = buildDashboard({ ...base(variants, owned, precos), filters: { rarities: ['SR'] } })
    expect(dash.totalCopies).toBe(2)
    expect(dash.bySet.find((s) => s.set.id === 's1')).toMatchObject({ variantsOwned: 1, variantsTotal: 1 })
  })

  it('por cor', () => {
    const dash = buildDashboard({ ...base(variants, owned, precos), filters: { colors: ['Blue'] } })
    expect(dash.totalValueUsd).toBe(6)
  })

  it('coleção filtrada aparece mesmo sem carta nenhuma dela', () => {
    const dash = buildDashboard({ ...base(variants, {}, precos), filters: { setId: 's1' } })
    expect(dash.bySet).toEqual([expect.objectContaining({ variantsOwned: 0, variantsTotal: 2, completeUsd: 11 })])
  })
})
