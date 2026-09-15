import { describe, expect, it } from 'vitest'
import {
  deduceByLigaTreatment,
  editionMatchesGroup,
  ligaIdentity,
  ligaTreatmentKey,
  sourceTreatmentKey,
  type LigaArt,
} from '@/server/domain/prices/liga-treatment'
import { tcgplayerProductUrl } from '@/server/domain/prices/tcgplayer-link'

/**
 * O tratamento conferido na Liga casando com o produto do TCGplayer (decisão 072).
 *
 * Os endereços são do jeito que a Liga os produz — é por isso que o nome da carta
 * e o código do fim precisam sair antes de ler os parênteses.
 */

const liga = (card: string, num: string, ed = 'OP-01') =>
  `https://www.ligaonepiece.com.br/?view=cards/card&card=${encodeURIComponent(card)}&ed=${ed}&num=${num}`

const art = (over: Partial<LigaArt> & Pick<LigaArt, 'variantId' | 'ligaUrl'>): LigaArt => ({
  cardCode: 'OP01-016',
  rarity: 'SR',
  cardName: 'Carta',
  parallelSets: ['OP01'],
  normalSets: ['OP01'],
  ...over,
})

describe('o tratamento que a Liga dá à arte', () => {
  it('lê os parênteses depois do nome, sem o código e sem o número', () => {
    expect(
      ligaTreatmentKey(art({ variantId: '1', cardName: 'Izo', ligaUrl: liga('Izo (033) (Jolly Roger Foil) (OP01-033-JR)', 'OP01-033-JR', 'PRB') })),
    ).toBe('jolly roger foil')
  })

  it('junta as partes na mesma forma do rótulo da fonte', () => {
    const key = ligaTreatmentKey(
      art({ variantId: '1', cardName: 'Nami', ligaUrl: liga('Nami (Alternate Art) (Manga) (OP01-016-MA)', 'OP01-016-MA') }),
    )
    expect(key).toBe(sourceTreatmentKey('Manga + Alternate Art'))
  })

  /* O personagem se chama `Mr.5(Gem)`: o parentese e do nome, e nao tratamento. */
  it('tira o nome da carta antes, para o parêntese do nome não virar tratamento', () => {
    expect(
      ligaTreatmentKey(art({ variantId: '1', cardName: 'Mr.5(Gem)', ligaUrl: liga('Mr.5(Gem) (OP04-072-A)', 'OP04-072-A') })),
    ).toBeNull()
  })

  it('o -PAR sem parênteses é Parallel, e a SP CARD sem parênteses é SP', () => {
    expect(ligaTreatmentKey(art({ variantId: '1', cardName: 'Sanji', ligaUrl: liga('Sanji (OP01-013-PAR)', 'OP01-013-PAR') }))).toBe('parallel')
    expect(
      ligaTreatmentKey(
        art({ variantId: '1', cardName: 'Trafalgar Law', rarity: 'SP CARD', ligaUrl: liga('Trafalgar Law (OP01-047)', 'OP01-047', 'OP-04') }),
      ),
    ).toBe('sp')
  })

  it('sem tratamento no nome, não sabe', () => {
    expect(ligaTreatmentKey(art({ variantId: '1', cardName: 'Otama', ligaUrl: liga('Otama (OP01-006)', 'OP01-006') }))).toBeNull()
    expect(ligaTreatmentKey(art({ variantId: '1', ligaUrl: undefined }))).toBeNull()
  })

  /*
   * Instrucao do dono do produto: a (Reprint) da Liga e a carta original
   * reimpressa na PRB, e o preco que o TCGplayer cota para ela e o da Pirate Foil.
   */
  it('a reimpressão vale como Pirate Foil quando a normal saiu no mesmo set', () => {
    const reprint = liga('Mountain God (Reprint) (EB01-018-RE)', 'EB01-018-RE', 'PRB2')
    expect(
      ligaTreatmentKey(art({ variantId: '1', cardName: 'Mountain God', ligaUrl: reprint, parallelSets: ['PRB-02'], normalSets: ['EB-01', 'PRB-02'] })),
    ).toBe('pirate foil')
    // Sem a normal no mesmo set, a reimpressao continua sendo reimpressao.
    expect(
      ligaTreatmentKey(art({ variantId: '1', cardName: 'Mountain God', ligaUrl: reprint, parallelSets: ['PRB-02'], normalSets: ['EB-01'] })),
    ).toBe('reprint')
  })
})

describe('os pares', () => {
  const nami = (variantId: string, tratamento: string, num: string) =>
    art({ variantId, cardName: 'Nami', ligaUrl: liga(`Nami (${tratamento}) (${num})`, num) })

  /* O caso que a raridade nao resolvia: SR | SR contra Alternate Art | Manga. */
  it('casa cada arte com o único produto do mesmo tratamento', () => {
    expect(
      deduceByLigaTreatment(
        [nami('1', 'Manga', 'OP01-016-MA'), nami('2', 'Alternate Art', 'OP01-016-AA')],
        [
          { productId: 'aa', label: 'Alternate Art' },
          { productId: 'ma', label: 'Manga' },
        ],
      ),
    ).toEqual([
      { variantId: '1', productId: 'ma' },
      { variantId: '2', productId: 'aa' },
    ])
  })

  it('não casa quando dois produtos têm o mesmo tratamento', () => {
    expect(
      deduceByLigaTreatment(
        [nami('1', 'Reprint', 'OP01-016-RE')],
        [
          { productId: 'prb', label: 'Reprint' },
          { productId: 'st', label: 'Reprint' },
        ],
      ),
    ).toEqual([])
  })

  /* A pagina da Liga que vale para duas artes: um produto nao tem dois donos. */
  it('não casa quando duas artes nossas têm o mesmo tratamento', () => {
    expect(
      deduceByLigaTreatment(
        [nami('1', 'Textured Foil', 'OP01-016-TF'), nami('2', 'Textured Foil', 'OP01-016-TF')],
        [{ productId: 'tf', label: 'Textured Foil' }],
      ),
    ).toEqual([])
  })

  it('igualdade exata: SP + Gold não é SP', () => {
    expect(
      deduceByLigaTreatment([nami('1', 'SP', 'OP01-016-SP')], [{ productId: 'gold', label: 'SP + Gold' }]),
    ).toEqual([])
  })
})

describe('o endereço no TCGplayer', () => {
  /* Conferido: o produto 454513 da fonte e a Zoro (001) (Parallel) no TCGplayer. */
  it('sai do número do produto vinculado', () => {
    expect(tcgplayerProductUrl('454513')).toBe('https://www.tcgplayer.com/product/454513')
  })

  it('sem vínculo, não há endereço', () => {
    expect(tcgplayerProductUrl(null)).toBeNull()
    expect(tcgplayerProductUrl(undefined)).toBeNull()
    expect(tcgplayerProductUrl('  ')).toBeNull()
  })
})

describe('a edição da Liga e o grupo do TCGplayer', () => {
  it('reconhece a mesma coleção escrita de outro jeito', () => {
    expect(editionMatchesGroup('PRB2', 'PRB-02')).toBe(true)
    expect(editionMatchesGroup('PRB', 'PRB-01')).toBe(true)
    expect(editionMatchesGroup('ST24', 'ST-24')).toBe(true)
    expect(editionMatchesGroup('OP-01', 'OP01')).toBe(true)
    expect(editionMatchesGroup('EB03', 'EB-03-04')).toBe(true)
    expect(editionMatchesGroup('OP-02-PR', 'OP02 PRE')).toBe(true)
  })

  /* `OP-15` e a colecao, e nao o evento de lancamento dela. */
  it('não confunde a coleção com o evento dela', () => {
    expect(editionMatchesGroup('OP-15', 'OP15-EB04')).toBe(true)
    expect(editionMatchesGroup('OP-15', 'OP15 RE')).toBe(false)
    expect(editionMatchesGroup('OP-14-RE', 'OP14 RE')).toBe(true)
    expect(editionMatchesGroup('OP-14-RE', 'OP14')).toBe(false)
  })

  it('edição sem par claro não corresponde a nada', () => {
    expect(editionMatchesGroup('PC-01', 'OP-PR')).toBe(false)
    expect(editionMatchesGroup('LTDS', 'LT-01')).toBe(false)
    expect(editionMatchesGroup(null, 'OP01')).toBe(false)
  })
})

describe('o que a edição e a pontuação resolvem', () => {
  const carta = (variantId: string, card: string, num: string, ed: string, over: Partial<LigaArt> = {}) =>
    art({ variantId, cardName: 'Nami', ligaUrl: liga(card, num, ed), ...over })

  it('pontuação não distingue tratamento', () => {
    expect(
      deduceByLigaTreatment(
        [carta('1', 'Nami (ST15 ST20 Release Event Pack) (OP01-016-EP)', 'OP01-016-EP', 'PC-01')],
        [{ productId: 'ep', label: 'ST15 - ST20 Release Event Pack' }],
      ),
    ).toEqual([{ variantId: '1', productId: 'ep' }])
  })

  /* A (Reprint) saiu na PRB-02 e no ST-24; a edicao da Liga diz qual. */
  it('dois produtos com o mesmo nome: fica o do grupo da edição', () => {
    expect(
      deduceByLigaTreatment(
        [carta('1', 'Nami (Reprint) (OP01-016-RE)', 'OP01-016-RE', 'ST24', { parallelSets: ['ST-24'], normalSets: ['OP01'] })],
        [
          { productId: 'prb', label: 'Reprint', groupCode: 'PRB-02' },
          { productId: 'st', label: 'Reprint', groupCode: 'ST-24' },
        ],
      ),
    ).toEqual([{ variantId: '1', productId: 'st' }])
  })

  it('a página sem tratamento de outra coleção casa com o produto sem tratamento daquele grupo', () => {
    expect(
      deduceByLigaTreatment(
        [carta('1', 'Nami (OP01-016)', 'OP01-016', 'ST31', { cardCode: 'OP01-016' })],
        [
          { productId: 'st31', label: '', groupCode: 'ST-31' },
          { productId: 'aa', label: 'Alternate Art', groupCode: 'OP01' },
        ],
      ),
    ).toEqual([{ variantId: '1', productId: 'st31' }])
  })

  /* Na colecao da propria carta, o produto sem tratamento e a normal. */
  it('nunca na coleção da própria carta', () => {
    expect(
      deduceByLigaTreatment(
        [art({ variantId: '1', cardCode: 'OP01-008', cardName: 'Cavendish', ligaUrl: liga('Cavendish (OP01-008-BT)', 'OP01-008-BT', 'OP-01') })],
        [{ productId: 'normal', label: '', groupCode: 'OP01' }],
      ),
    ).toEqual([])
  })

  it('o nome escrito de outro jeito e o número de quatro dígitos não viram tratamento', () => {
    expect(
      ligaTreatmentKey(art({ variantId: '1', cardName: 'Mr.1(Daz.Bonez)', ligaUrl: liga('Mr. 1 (Daz.Bonez) (Alternate Art) (EB01-027-AA)', 'EB01-027-AA', 'EB01') })),
    ).toBe('alternate art')
    expect(
      ligaTreatmentKey(art({ variantId: '1', cardName: 'Tony Tony.Chopper', ligaUrl: liga('Tony Tony.Chopper (0070) (Parallel) (OP08-007-PA)', 'OP08-007-PA', 'OP-08') })),
    ).toBe('parallel')
  })
})

describe('a identidade que a Liga dá à arte', () => {
  it('é o tratamento, quando há', () => {
    expect(
      ligaIdentity(art({ variantId: '1', cardName: 'Shanks', ligaUrl: liga('Shanks (OP01-120-PAR)', 'OP01-120-PAR') })).chave,
    ).toBe('parallel')
  })

  /* Sem tratamento, so a edicao de outra colecao identifica; na propria, e a normal. */
  it('sem tratamento, é a edição de outra coleção, e nunca a da própria', () => {
    expect(
      ligaIdentity(art({ variantId: '1', cardCode: 'OP01-016', cardName: 'Nami', ligaUrl: liga('Nami (OP01-016)', 'OP01-016', 'ST31') })).chave,
    ).toBe('sem tratamento em ST31')
    expect(
      ligaIdentity(art({ variantId: '1', cardCode: 'OP01-008', cardName: 'Cavendish', ligaUrl: liga('Cavendish (OP01-008-BT)', 'OP01-008-BT', 'OP-01') })).chave,
    ).toBeNull()
  })
})
