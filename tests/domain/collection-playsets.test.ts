import { describe, expect, it } from 'vitest'
import { missingCopies, readPlayset } from '@/server/domain/collection/playsets'

/**
 * A leitura de um playset, carta por carta (decisão 114).
 *
 * `collection-counting.test.ts` guarda a aritmética da coleção inteira. Aqui é a
 * leitura de **uma** carta: quanto tem, se fechou, e o aviso de arte paralela.
 */

describe('readPlayset', () => {
  it('soma todas as artes da carta', () => {
    const leitura = readPlayset('Character', [
      { variantType: 'Normal', quantity: 2 },
      { variantType: 'Parallel', quantity: 2 },
    ])

    expect(leitura.quantity).toBe(4)
    expect(leitura.closed).toBe(true)
  })

  /* A carta que a pessoa não tem. É o `0/4`, e é o que esta tela existe para mostrar. */
  it('sem nenhuma cópia, zero e aberto', () => {
    expect(readPlayset('Character', [])).toEqual({
      quantity: 0,
      closed: false,
      otherArtCopies: 0,
    })
  })

  it('oito cópias continuam sendo um playset, e não dois', () => {
    const leitura = readPlayset('Character', [{ variantType: 'Normal', quantity: 8 }])

    expect(leitura.quantity).toBe(8)
    expect(leitura.closed).toBe(true)
  })

  it('Leader nunca fecha, nem com dez cópias', () => {
    expect(readPlayset('Leader', [{ variantType: 'Normal', quantity: 10 }]).closed).toBe(false)
  })

  it('DON!! nunca fecha (decisão 112)', () => {
    expect(readPlayset('DON', [{ variantType: 'Normal', quantity: 10 }]).closed).toBe(false)
  })

  it('quantidade zero ou negativa é ignorada', () => {
    const leitura = readPlayset('Character', [
      { variantType: 'Normal', quantity: 0 },
      { variantType: 'Parallel', quantity: -3 },
      { variantType: 'Normal', quantity: 1 },
    ])

    expect(leitura.quantity).toBe(1)
    expect(leitura.otherArtCopies).toBe(0)
  })

  describe('o aviso de outra arte', () => {
    /*
     * O precedente e a decisao 095, item 4a: na conferencia do deck a linha diz
     * quantas das copias que contaram sao de outra arte. A diferenca e a
     * referencia — num playset nao existe arte escolhida, entao e a Normal.
     */
    it('conta as cópias de arte paralela', () => {
      const leitura = readPlayset('Character', [
        { variantType: 'Normal', quantity: 3 },
        { variantType: 'Parallel', quantity: 1 },
      ])

      expect(leitura.closed).toBe(true)
      expect(leitura.otherArtCopies).toBe(1)
    })

    it('não avisa quando todas são Normal', () => {
      expect(readPlayset('Character', [{ variantType: 'Normal', quantity: 4 }]).otherArtCopies).toBe(
        0,
      )
    })

    /* Quatro paralelas fecham o playset: para jogar, a arte não importa. */
    it('quatro paralelas fecham, e as quatro são avisadas', () => {
      const leitura = readPlayset('Character', [{ variantType: 'Parallel', quantity: 4 }])

      expect(leitura.closed).toBe(true)
      expect(leitura.otherArtCopies).toBe(4)
    })
  })
})

describe('missingCopies', () => {
  it('conta o que falta', () => {
    expect(missingCopies(0)).toBe(4)
    expect(missingCopies(3)).toBe(1)
  })

  /* Oito cópias faltam zero, e não menos quatro: o playset é binário. */
  it('nunca é negativo', () => {
    expect(missingCopies(4)).toBe(0)
    expect(missingCopies(8)).toBe(0)
  })
})
