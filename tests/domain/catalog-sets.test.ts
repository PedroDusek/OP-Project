import { describe, expect, it } from 'vitest'
import {
  cardCountLabel,
  compareSetCodes,
  compareSetsByRelease,
  compareSetsForCatalog,
  displaySetCode,
  displaySetName,
  releasePosition,
  setKind,
  setSortKey,
} from '@/server/domain/catalog/sets'

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
   * A regra e simetrica de proposito: remover so o hifen final deixaria um nome
   * pela metade, pior que o original.
   *
   * Os nomes reais em que isso apareceu — `BOOSTER PACK -X-` — hoje perdem o
   * rotulo de tipo antes, e por isso o exemplo aqui e generico: o que se
   * protege e a regra, nao o dado.
   */
  it('nao mexe quando o hifen nao cerca o nome inteiro', () => {
    expect(displaySetName('COLETANEA -ALGUMA COISA-')).toBe('COLETANEA -ALGUMA COISA-')
    expect(displaySetName('Algo -no fim-')).toBe('Algo -no fim-')
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

describe('setKind', () => {
  /**
   * A classificacao espelha o rotulo que a fonte publica no seletor de series,
   * conferido um a um no snapshot: todo `ST` e deck, nenhum booster e `ST`.
   */
  it('separa deck, colecao e promocional pelo prefixo', () => {
    expect(setKind('ST-01')).toBe('deck')
    expect(setKind('ST13')).toBe('deck')
    expect(setKind('ST-36')).toBe('deck')

    expect(setKind('OP01')).toBe('collection')
    expect(setKind('OP-17')).toBe('collection')
    expect(setKind('EB-01')).toBe('collection')
    expect(setKind('PRB-01')).toBe('collection')
    expect(setKind('OP14-EB04')).toBe('collection')
    expect(setKind('GC-01')).toBe('collection')

    expect(setKind('PROMO')).toBe('promo')
  })
})

describe('compareSetsByRelease', () => {
  /**
   * A ordem foi informada pelo dono do produto e nao se deriva do que temos: os
   * extra boosters saem **entre** os boosters, e nenhuma ordenacao de codigo
   * produz esse intercalamento.
   */
  it('intercala os extra boosters entre os boosters', () => {
    const codes = ['EB-03', 'OP01', 'OP-13', 'EB-01', 'OP06', 'OP-07']
    expect([...codes].sort(compareSetsByRelease)).toEqual([
      'OP01',
      'OP06',
      'EB-01',
      'OP-07',
      'OP-13',
      'EB-03',
    ])
  })

  it('reconhece o codigo apesar da grafia da fonte', () => {
    // A lista original diz `OP-14`; o catalogo importado tem `OP14-EB04`.
    expect(releasePosition('OP14-EB04')).not.toBeNull()
    expect(releasePosition('OP-01')).toBe(releasePosition('OP01'))
  })

  /**
   * O que a ordem nao cobre vai para o fim, e nao some: uma coletanea nova
   * aparece na lista no dia em que for importada.
   */
  it('poe o desconhecido depois do conhecido, em ordem natural', () => {
    const codes = ['ST-02', 'OP-17', 'ST-01', 'PROMO', 'OP01']
    expect([...codes].sort(compareSetsByRelease)).toEqual([
      'OP01',
      'OP-17',
      'PROMO',
      'ST-01',
      'ST-02',
    ])
  })

  it('a ordem completa das colecoes bate com a informada', () => {
    const catalogo = [
      'OP-16', 'EB-02', 'OP04', 'OP-11', 'OP15-EB04', 'OP01', 'OP-09', 'EB-01',
      'OP-12', 'OP05', 'OP-08', 'OP02', 'OP-17', 'OP-10', 'OP14-EB04', 'OP06',
      'OP-13', 'EB-03', 'OP03', 'OP-07',
    ]
    expect([...catalogo].sort(compareSetsByRelease)).toEqual([
      'OP01', 'OP02', 'OP03', 'OP04', 'OP05', 'OP06',
      'EB-01',
      'OP-07', 'OP-08', 'OP-09', 'OP-10',
      'EB-02',
      'OP-11', 'OP-12', 'OP-13',
      'OP14-EB04',
      'EB-03',
      'OP15-EB04',
      'OP-16', 'OP-17',
    ])
  })
})

describe('displaySetName, prefixo de tipo', () => {
  /**
   * A importacao pegou o rotulo de forma inconsistente: `OP-17` veio com
   * `BOOSTER PACK` na frente e `OP-01` sem, embora os dois sejam booster pack.
   */
  it('remove o rotulo de tipo que veio grudado', () => {
    expect(displaySetName('BOOSTER PACK -THE WORLD’S STRONGEST WARRIORS-')).toBe(
      'THE WORLD’S STRONGEST WARRIORS',
    )
    expect(displaySetName('STARTER DECK -RED Monkey.D.Luffy-')).toBe('RED Monkey.D.Luffy')
  })

  /** `STARTER DECK` casaria dentro de `STARTER DECK EX` e deixaria um `EX` solto. */
  it('casa o rotulo mais longo primeiro', () => {
    expect(displaySetName('STARTER DECK EX -GEAR5-')).toBe('GEAR5')
  })

  it('nao mexe em nome que nao comeca com rotulo', () => {
    expect(displaySetName('GIFT COLLECTION 2023')).toBe('GIFT COLLECTION 2023')
  })
})

describe('cardCountLabel', () => {
  /**
   * Diz "cartas" e conta variantes. A palavra e escolha do dono do produto; a
   * distincao entre carta e variante continua valendo no resto do sistema.
   */
  it('usa singular e plural, com separador de milhar', () => {
    expect(cardCountLabel(1)).toBe('1 carta')
    expect(cardCountLabel(154)).toBe('154 cartas')
    expect(cardCountLabel(0)).toBe('0 cartas')
    expect(cardCountLabel(4843)).toMatch(/^4\.843 cartas$/)
  })
})

describe('compareSetsForCatalog', () => {
  /**
   * A ordem de uma listagem de cartas sem filtro: colecoes por lancamento,
   * depois starter decks, depois promocionais.
   */
  it('agrupa colecao, depois deck, depois promocional', () => {
    const sets = ['PROMO', 'ST-01', 'OP-13', 'ST-36', 'OP01', 'PROMO']
    expect([...sets].sort(compareSetsForCatalog)).toEqual([
      'OP01',
      'OP-13',
      'ST-01',
      'ST-36',
      'PROMO',
      'PROMO',
    ])
  })

  it('dentro das colecoes, vale a ordem de lancamento', () => {
    const sets = ['OP-07', 'EB-01', 'OP06']
    expect([...sets].sort(compareSetsForCatalog)).toEqual(['OP06', 'EB-01', 'OP-07'])
  })

  /** Os numeros dos starter decks sao a ordem de lancamento deles. */
  it('dentro dos decks, vale o numero', () => {
    const sets = ['ST13', 'ST-02', 'ST-36', 'ST-01']
    expect([...sets].sort(compareSetsForCatalog)).toEqual(['ST-01', 'ST-02', 'ST13', 'ST-36'])
  })

  /**
   * O catalogo tem uma variante sem impressao nenhuma. Ela vai para o fim em
   * vez de quebrar a ordenacao.
   */
  it('poe o que nao tem set no fim de tudo', () => {
    const sets = [null, 'PROMO', 'OP01', null]
    expect([...sets].sort(compareSetsForCatalog)).toEqual(['OP01', 'PROMO', null, null])
  })

  it('e simetrica e estavel', () => {
    const sets = ['PROMO', 'ST-05', 'OP03', 'EB-02']
    const frente = [...sets].sort(compareSetsForCatalog)
    const tras = [...sets].reverse().sort(compareSetsForCatalog)
    expect(frente).toEqual(tras)
    expect(compareSetsForCatalog('OP01', 'OP01')).toBe(0)
  })
})

describe('displaySetCode', () => {
  /**
   * A fonte grafa a mesma familia de dois jeitos: `OP01` ate `OP06` sem hifen e
   * `OP-07` em diante com. Numa lista isso parece defeito.
   */
  it('tira o hifen entre as letras e o numero', () => {
    expect(displaySetCode('ST-01')).toBe('ST01')
    expect(displaySetCode('OP-07')).toBe('OP07')
    expect(displaySetCode('EB-01')).toBe('EB01')
    expect(displaySetCode('PRB-02')).toBe('PRB02')
    expect(displaySetCode('GC-01')).toBe('GC01')
  })

  it('nao mexe no que ja esta uniforme', () => {
    expect(displaySetCode('OP01')).toBe('OP01')
    expect(displaySetCode('ST13')).toBe('ST13')
    expect(displaySetCode('PROMO')).toBe('PROMO')
  })

  /** Ali o hifen junta duas identidades de set, e nao e decoracao. */
  it('preserva o hifen que separa dois codigos', () => {
    expect(displaySetCode('OP14-EB04')).toBe('OP14-EB04')
    expect(displaySetCode('OP15-EB04')).toBe('OP15-EB04')
  })

  /** O codigo real continua indo na URL: normalizar quebraria link antigo. */
  it('e so exibicao, e nao substitui o codigo', () => {
    expect(displaySetCode('ST-01')).not.toBe('ST-01')
    expect(displaySetCode('ST-01')).toBe('ST01')
  })
})
