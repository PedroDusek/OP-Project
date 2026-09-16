import { describe, expect, it } from 'vitest'
import { normalProduct } from '@/server/domain/prices/normal-product'

/**
 * O produto da normal quando o número saiu em mais de um grupo (decisão 076).
 * Os candidatos vêm na ordem da fonte, que começa pelos lançamentos mais novos.
 */

describe('o produto da normal', () => {
  /* O caso medido: a Zoro do OP-DD custava US$ 8,30, e a do OP01, US$ 2,15. */
  it('fica com o grupo da coleção do código, mesmo vindo depois', () => {
    expect(
      normalProduct('OP01-001', [
        { productId: 'dd', groupCode: 'OP-DD', value: 8.3 },
        { productId: 'op01', groupCode: 'OP01', value: 2.15 },
      ]),
    ).toEqual({ productId: 'op01', value: 2.15 })
  })

  it('reconhece a coleção escrita de outro jeito, e não o evento dela', () => {
    expect(
      normalProduct('ST01-011', [
        { productId: 'pre', groupCode: 'ST-01 PRE', value: 9 },
        { productId: 'st01', groupCode: 'ST-01', value: 4.88 },
      ]).productId,
    ).toBe('st01')
  })

  /* Buscar o preco de outro grupo traria a reimpressao de volta. */
  it('sem cotação no grupo da coleção, fica sem preço', () => {
    expect(
      normalProduct('ST04-003', [
        { productId: 'reimpressao', groupCode: 'OP-RP', value: 15.75 },
        { productId: 'st04', groupCode: 'ST-04', value: undefined },
      ]),
    ).toEqual({ productId: 'st04', value: null })
  })

  /* A promo `P-` nao nomeia colecao: vale a regra de antes. */
  it('sem o grupo da coleção, a imagem do primeiro grupo e o preço do primeiro que tem', () => {
    expect(
      normalProduct('P-001', [
        { productId: 'sem-cotacao', groupCode: 'OP-PR', value: undefined },
        { productId: 'outro', groupCode: 'OP-XX', value: 40.75 },
      ]),
    ).toEqual({ productId: 'sem-cotacao', value: 40.75 })
  })
})
