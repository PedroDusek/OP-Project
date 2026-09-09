import { describe, expect, it } from 'vitest'
import { crossOffer, crossTrade } from '@/server/domain/trades/crossing'

/**
 * O cruzamento entre o que um oferece e o que o outro quer.
 *
 * So roda dentro de uma troca em que as duas pessoas entraram
 * (`business-rules.md` 4.6.1): e o consentimento das duas que autoriza o dado
 * privado de uma a encostar no da outra. Estas funcoes nao sabem encontrar
 * ninguem — recebem os dois lados ja autorizados.
 */

const tem = (variantId: string, quantity: number) => ({ variantId, quantity })
const quer = (variantId: string, wanted: number, owned = 0) => ({ variantId, wanted, owned })

describe('uma direcao', () => {
  it('cobre o que o outro quer, ate o que se tem', () => {
    expect(crossOffer([tem('1', 3)], [quer('1', 4)])).toEqual([
      { variantId: '1', quantity: 3, available: 3, stillWanted: 4 },
    ])
  })

  it('nao oferece mais do que o outro quer', () => {
    expect(crossOffer([tem('1', 4)], [quer('1', 2)])[0].quantity).toBe(2)
  })

  /** O que ele ja tem sai da conta: falta o resto, e nao o total. */
  it('desconta o que o outro ja possui', () => {
    const [match] = crossOffer([tem('1', 4)], [quer('1', 4, 3)])

    expect(match).toMatchObject({ quantity: 1, stillWanted: 1 })
  })

  it('nao cruza carta que o outro nao quer', () => {
    expect(crossOffer([tem('1', 3)], [quer('2', 4)])).toEqual([])
  })

  /**
   * Zero nao e um match fraco, e a ausencia de um. Uma lista cheia de zeros
   * faria a pessoa procurar o que interessa no meio do que nao interessa.
   */
  it('omite o want ja satisfeito', () => {
    expect(crossOffer([tem('1', 3)], [quer('1', 2, 2)])).toEqual([])
  })

  it('omite quem nao tem nenhuma copia disponivel', () => {
    expect(crossOffer([tem('1', 0)], [quer('1', 4)])).toEqual([])
  })

  /**
   * Want e por variante (regra 4.4): quem quer a paralela nao se satisfaz com a
   * normal, e as duas nunca se cruzam entre si.
   */
  it('nao confunde variantes da mesma carta', () => {
    expect(crossOffer([tem('normal', 4)], [quer('paralela', 4)])).toEqual([])
  })

  it('devolve varias cartas quando ha varias', () => {
    const cruzado = crossOffer(
      [tem('1', 2), tem('2', 1), tem('3', 5)],
      [quer('1', 4), quer('3', 1)],
    )

    expect(cruzado.map((c) => c.variantId)).toEqual(['1', '3'])
  })
})

describe('as duas direcoes', () => {
  const ana = {
    available: [tem('zoro', 3), tem('nami', 1)],
    wanted: [quer('luffy', 2)],
  }
  const bruno = {
    available: [tem('luffy', 4)],
    wanted: [quer('zoro', 1), quer('nami', 2, 2)],
  }

  it('cruza cada lado com o want do outro', () => {
    const { fromFirst, fromSecond } = crossTrade(ana, bruno)

    expect(fromFirst).toEqual([{ variantId: 'zoro', quantity: 1, available: 3, stillWanted: 1 }])
    expect(fromSecond).toEqual([{ variantId: 'luffy', quantity: 2, available: 4, stillWanted: 2 }])
  })

  /**
   * Inverter os lados errado produziria uma lista plausivel e falsa, que e o
   * pior tipo de defeito num lugar onde as pessoas combinam dar coisas uma a
   * outra. Trocar a ordem tem de trocar as duas listas de lugar, e nada mais.
   */
  it('e simetrica: inverter os lados inverte as listas', () => {
    const direta = crossTrade(ana, bruno)
    const invertida = crossTrade(bruno, ana)

    expect(invertida.fromFirst).toEqual(direta.fromSecond)
    expect(invertida.fromSecond).toEqual(direta.fromFirst)
  })

  it('devolve as duas vazias quando nao ha interesse nenhum', () => {
    const cruzado = crossTrade(
      { available: [tem('a', 3)], wanted: [quer('b', 1)] },
      { available: [tem('c', 3)], wanted: [quer('d', 1)] },
    )

    expect(cruzado).toEqual({ fromFirst: [], fromSecond: [] })
  })

  /** Interesse de um lado so e uma troca possivel, e nao um erro. */
  it('aceita interesse em uma direcao so', () => {
    const cruzado = crossTrade(
      { available: [tem('a', 3)], wanted: [] },
      { available: [], wanted: [quer('a', 1)] },
    )

    expect(cruzado.fromFirst).toHaveLength(1)
    expect(cruzado.fromSecond).toEqual([])
  })
})
