import { describe, expect, it } from 'vitest'
import { marketPriceOf } from '@/server/domain/prices/finish'

/** O preço de mercado entre os acabamentos do mesmo produto (decisões 050 e 078). */

describe('o preço entre os acabamentos', () => {
  /* A impressao base de lider, SR e SEC e foil: a cotacao unica vale, seja qual for. */
  it('com uma cotação só, é ela', () => {
    expect(marketPriceOf([{ subType: 'Foil', value: 614.28 }])).toBe(614.28)
  })

  /* Decisao 078: a OP02-041 cota 0,39 normal e 0,82 foil. */
  it('com Normal e Foil, vale a Normal', () => {
    expect(
      marketPriceOf([
        { subType: 'Foil', value: 0.82 },
        { subType: 'Normal', value: 0.39 },
      ]),
    ).toBe(0.39)
  })

  it('com dois acabamentos e nenhum Normal, não inventa', () => {
    expect(
      marketPriceOf([
        { subType: 'Foil', value: 1 },
        { subType: 'Holofoil', value: 2 },
      ]),
    ).toBeNull()
    expect(marketPriceOf([])).toBeNull()
  })
})
