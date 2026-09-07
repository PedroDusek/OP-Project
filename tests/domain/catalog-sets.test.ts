import { describe, expect, it } from 'vitest'
import { compareSetCodes, displaySetName, setSortKey } from '@/server/domain/catalog/sets'

/**
 * Os codigos abaixo sao os que existem no catalogo importado, e nao exemplos
 * inventados: a fonte mistura `OP01` com `OP-07` e `ST13` com `ST-01`, e e essa
 * mistura que a ordenacao precisa aguentar.
 */

describe('setSortKey', () => {
  it('separa prefixo e numero, ignorando a pontuacao da fonte', () => {
    expect(setSortKey('OP01')).toEqual(['OP', 1, 'OP01'])
    expect(setSortKey('OP-07')).toEqual(['OP', 7, 'OP07'])
    expect(setSortKey('ST13')).toEqual(['ST', 13, 'ST13'])
    expect(setSortKey('PRB-02')).toEqual(['PRB', 2, 'PRB02'])
  })

  /** `OP14-EB04` e um set de OP; o `EB04` no fim nao muda a familia dele. */
  it('usa o primeiro numero em codigo composto', () => {
    expect(setSortKey('OP14-EB04')).toEqual(['OP', 14, 'OP14EB04'])
  })

  it('manda codigo sem numero para o fim do proprio prefixo', () => {
    expect(setSortKey('PROMO')).toEqual(['PROMO', Number.POSITIVE_INFINITY, 'PROMO'])
  })
})

describe('compareSetCodes', () => {
  /**
   * O caso que motiva o arquivo inteiro: ordenar por texto puro poe `OP-07`
   * antes de `OP01`, quebrando a unica sequencia que a pessoa reconhece.
   */
  it('ordena numericamente apesar da grafia inconsistente', () => {
    const codes = ['OP-13', 'OP01', 'OP-07', 'OP02', 'OP-10']
    expect([...codes].sort(compareSetCodes)).toEqual(['OP01', 'OP02', 'OP-07', 'OP-10', 'OP-13'])
  })

  it('mantem OP14-EB04 entre OP13 e OP15', () => {
    const codes = ['OP15-EB04', 'OP-13', 'OP14-EB04']
    expect([...codes].sort(compareSetCodes)).toEqual(['OP-13', 'OP14-EB04', 'OP15-EB04'])
  })

  it('agrupa por prefixo antes de comparar numero', () => {
    const codes = ['ST-01', 'OP01', 'EB-01', 'PROMO', 'PRB-01', 'GC-01']
    expect([...codes].sort(compareSetCodes)).toEqual([
      'EB-01',
      'GC-01',
      'OP01',
      'PRB-01',
      'PROMO',
      'ST-01',
    ])
  })

  it('e estavel: a ordenacao nao depende da ordem de entrada', () => {
    const codes = ['ST-36', 'ST13', 'ST-01', 'ST-09']
    const forward = [...codes].sort(compareSetCodes)
    const backward = [...codes].reverse().sort(compareSetCodes)
    expect(forward).toEqual(backward)
    expect(forward).toEqual(['ST-01', 'ST-09', 'ST13', 'ST-36'])
  })
})

describe('displaySetName', () => {
  it('remove os hifens decorativos quando cercam o nome inteiro', () => {
    expect(displaySetName('-ROMANCE DAWN-')).toBe('ROMANCE DAWN')
    expect(displaySetName('-Straw Hat Crew-')).toBe('Straw Hat Crew')
  })

  /**
   * A regra e simetrica de proposito. Remover so o hifen final de
   * `BOOSTER PACK -X-` deixaria um nome pela metade, pior que o original.
   */
  it('nao mexe quando o hifen nao cerca o nome inteiro', () => {
    expect(displaySetName('BOOSTER PACK -THE WORLD’S STRONGEST WARRIORS-')).toBe(
      'BOOSTER PACK -THE WORLD’S STRONGEST WARRIORS-',
    )
    expect(displaySetName('STARTER DECK -RED Monkey.D.Luffy-')).toBe(
      'STARTER DECK -RED Monkey.D.Luffy-',
    )
  })

  it('deixa intacto o nome que nao tem decoracao', () => {
    expect(displaySetName('GIFT COLLECTION 2023')).toBe('GIFT COLLECTION 2023')
    expect(displaySetName('One Piece Promotion Cards')).toBe('One Piece Promotion Cards')
  })

  it('nao apaga um nome curto formado so de hifens', () => {
    expect(displaySetName('--')).toBe('--')
    expect(displaySetName('-')).toBe('-')
  })
})
