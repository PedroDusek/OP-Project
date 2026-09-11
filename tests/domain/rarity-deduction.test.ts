import { describe, expect, it } from 'vitest'
import { deduceArtPairs, type OurArt, type SourceArt } from '@/server/domain/prices/rarity-deduction'

/**
 * A dedução por raridade (decisão 068).
 *
 * O que se protege aqui é a fronteira entre deduzir e chutar. `SP CARD` só casa
 * com `SP` quando cada um é o único do seu lado; em qualquer outro caso, a arte
 * fica para o olho humano. No campo de dinheiro, o erro caro é o palpite, e não
 * a falta de preço.
 */

const nossa = (variantId: string, rarity: string | null): OurArt => ({ variantId, rarity })
const daFonte = (productId: string, label: string): SourceArt => ({ productId, label })

describe('o caso sem escolha, como antes', () => {
  it('casa uma arte de cada lado', () => {
    const r = deduceArtPairs([nossa('a', 'SR')], [daFonte('1', 'Alternate Art')])
    expect(r.pairs).toEqual([{ variantId: 'a', productId: '1' }])
    expect(r.viaRarity).toBe(0)
  })

  it('nao casa duas de cada lado sem raridade que distinga', () => {
    const r = deduceArtPairs(
      [nossa('a', 'SR'), nossa('b', 'SR')],
      [daFonte('1', 'Alternate Art'), daFonte('2', 'Manga')],
    )
    expect(r.pairs).toEqual([])
    expect(r.leftoverOurs).toHaveLength(2)
    expect(r.leftoverTheirs).toHaveLength(2)
  })
})

describe('a raridade desempata', () => {
  /* O exemplo real: EB03-003, nos `SR | SP CARD`, a fonte `Alternate Art | SP`. */
  it('casa SP CARD com SP, e o que sobra com o que sobra', () => {
    const r = deduceArtPairs(
      [nossa('sr', 'SR'), nossa('sp', 'SP CARD')],
      [daFonte('1', 'Alternate Art'), daFonte('2', 'SP')],
    )
    expect(r.pairs).toEqual(
      expect.arrayContaining([
        { variantId: 'sp', productId: '2' },
        { variantId: 'sr', productId: '1' },
      ]),
    )
    expect(r.pairs).toHaveLength(2)
    expect(r.viaRarity).toBe(1)
  })

  it('casa TR com TR', () => {
    const r = deduceArtPairs(
      [nossa('tr', 'TR'), nossa('sr', 'SR')],
      [daFonte('1', 'TR'), daFonte('2', 'Parallel')],
    )
    expect(r.pairs).toHaveLength(2)
    expect(r.pairs).toContainEqual({ variantId: 'tr', productId: '1' })
  })

  it('ignora caixa e espaco na comparacao', () => {
    const r = deduceArtPairs([nossa('sp', ' sp card '), nossa('x', 'SR')], [daFonte('1', 'sp'), daFonte('2', 'Manga')])
    expect(r.pairs).toContainEqual({ variantId: 'sp', productId: '1' })
  })

  /* O par deduzido vale mesmo que o resto continue ambiguo. */
  it('casa o que deduz e deixa o resto para o olho humano', () => {
    const r = deduceArtPairs(
      [nossa('sp', 'SP CARD'), nossa('a', 'SR'), nossa('b', 'SR')],
      [daFonte('1', 'SP'), daFonte('2', 'Alternate Art'), daFonte('3', 'Manga')],
    )
    expect(r.pairs).toEqual([{ variantId: 'sp', productId: '1' }])
    expect(r.leftoverOurs.map((x) => x.variantId)).toEqual(['a', 'b'])
    expect(r.leftoverTheirs.map((x) => x.productId)).toEqual(['2', '3'])
  })
})

describe('a fronteira com o palpite', () => {
  /* Duas SP CARD nossas: a raridade nao diz qual e qual. */
  it('nao casa quando ha duas SP CARD', () => {
    const r = deduceArtPairs(
      [nossa('a', 'SP CARD'), nossa('b', 'SP CARD')],
      [daFonte('1', 'SP'), daFonte('2', 'Alternate Art')],
    )
    expect(r.pairs).toEqual([])
  })

  /* `SP + Gold` e `SP + Silver` sao duas artes SP: igualdade exata, nao prefixo. */
  it('nao casa SP CARD com SP + Gold', () => {
    const r = deduceArtPairs(
      [nossa('sp', 'SP CARD'), nossa('x', 'SR')],
      [daFonte('1', 'SP + Gold'), daFonte('2', 'SP + Silver')],
    )
    expect(r.pairs).toEqual([])
  })

  it('nao inventa par quando a fonte nao tem nada', () => {
    const r = deduceArtPairs([nossa('a', 'SP CARD')], [])
    expect(r.pairs).toEqual([])
    expect(r.leftoverOurs).toHaveLength(1)
  })
})
