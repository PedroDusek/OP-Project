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
    expect(ligaTreatmentKey(art({ variantId: '1', cardCode: 'OP01-013', cardName: 'Sanji', ligaUrl: liga('Sanji (OP01-013-PAR)', 'OP01-013-PAR') }))).toBe('parallel')
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

  /* Medido: a Shanks OP01-120 ficava sem preco nas duas paralelas. */
  it('a paralela -PAR casa mesmo com a -E-PAR na mesma carta', () => {
    const shanks = (variantId: string, num: string) =>
      art({ variantId, cardCode: 'OP01-120', cardName: 'Shanks', ligaUrl: liga(`Shanks (${num})`, num) })
    expect(
      deduceByLigaTreatment(
        [shanks('1', 'OP01-120-PAR'), shanks('2', 'OP01-120-E-PAR')],
        [
          { productId: 'par', label: 'Parallel', groupCode: 'OP01' },
          { productId: 'manga', label: 'Parallel + Manga + Alternate Art', groupCode: 'OP01' },
        ],
      ),
    ).toEqual([{ variantId: '1', productId: 'par' }])
  })

  /* A OP05-006: a Alternate Art da OP-05 e a da reimpressao na PRB, com o mesmo nome. */
  it('mesmo tratamento em edições diferentes: cada uma com o produto do grupo dela', () => {
    const koala = (variantId: string, ed: string) =>
      art({ variantId, cardCode: 'OP05-006', cardName: 'Koala', ligaUrl: liga('Koala (Alternate Art) (OP05-006-AA)', 'OP05-006-AA', ed) })
    expect(
      deduceByLigaTreatment(
        [koala('1', 'OP-05'), koala('2', 'PRB')],
        [
          { productId: 'prb', label: 'Alternate Art', groupCode: 'PRB-01' },
          { productId: 'op05', label: 'Alternate Art', groupCode: 'OP05' },
        ],
      ),
    ).toEqual([
      { variantId: '1', productId: 'op05' },
      { variantId: '2', productId: 'prb' },
    ])
  })

  /* So a edicao de uma delas tem grupo: a outra fica sem, e nao leva o da irma. */
  it('desempatada pela edição, nunca leva o produto de outro grupo', () => {
    const chopper = (variantId: string, ed: string) =>
      art({ variantId, cardCode: 'ST01-006', cardName: 'Tony Tony.Chopper', ligaUrl: liga('Tony Tony.Chopper (Alternate Art) (ST01-006-AA)', 'ST01-006-AA', ed) })
    expect(
      deduceByLigaTreatment(
        [chopper('1', 'PC-01'), chopper('2', 'PRB')],
        [
          { productId: 'promo', label: 'Alternate Art', groupCode: 'OP-PR' },
          { productId: 'prb', label: 'Alternate Art', groupCode: 'PRB-01' },
        ],
      ),
    ).toEqual([{ variantId: '2', productId: 'prb' }])
  })

  /* A OP02-028_p1: a pagina do pre-lancamento, sem tratamento no nome. */
  it('o pré-lançamento da coleção não é a página da normal', () => {
    const usopp = art({ variantId: '1', cardCode: 'OP02-028', cardName: 'Usopp', rarity: 'C', ligaUrl: liga('Usopp (OP02-028)', 'OP02-028', 'OP-02-PR') })
    expect(ligaIdentity(usopp).chave).toBe('sem tratamento em OP-02-PR')
    expect(
      deduceByLigaTreatment([usopp], [
        { productId: 'normal', label: '', groupCode: 'OP02' },
        { productId: 'pre', label: '', groupCode: 'OP02 PRE' },
      ]),
    ).toEqual([{ variantId: '1', productId: 'pre' }])
  })

  /* A OP07-031_p1: a normal tambem saiu na PRB-02, mas a pagina e a do ST-24. */
  it('a reimpressão de outra edição continua reimpressão, e casa pelo grupo', () => {
    const bartolomeo = art({
      variantId: '1',
      cardCode: 'OP07-031',
      cardName: 'Bartolomeo',
      rarity: 'C',
      ligaUrl: liga('Bartolomeo (Reprint) (OP07-031-RE)', 'OP07-031-RE', 'ST24'),
      parallelSets: ['ST-24', 'PRB-02'],
      normalSets: ['OP07', 'PRB-02'],
    })
    expect(ligaTreatmentKey(bartolomeo)).toBe('reprint')
    expect(
      deduceByLigaTreatment([bartolomeo], [
        { productId: 'pf', label: 'Pirate Foil', groupCode: 'PRB-02' },
        { productId: 're-prb', label: 'Reprint', groupCode: 'PRB-02' },
        { productId: 're-st', label: 'Reprint', groupCode: 'ST-24' },
      ]),
    ).toEqual([{ variantId: '1', productId: 're-st' }])
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
      ligaIdentity(art({ variantId: '1', cardCode: 'OP01-120', cardName: 'Shanks', ligaUrl: liga('Shanks (OP01-120-PAR)', 'OP01-120-PAR') })).chave,
    ).toBe('parallel')
  })

  /*
   * O caso real: a Liga da a paralela da Shanks como `-PAR` e a Manga como
   * `-E-PAR`, as duas sem tratamento no nome. So o `-PAR` puro e a paralela.
   */
  it('só o -PAR puro é a paralela: o -E-PAR não', () => {
    const shanks = (num: string) => art({ variantId: '1', cardCode: 'OP01-120', cardName: 'Shanks', ligaUrl: liga(`Shanks (${num})`, num) })
    expect(ligaTreatmentKey(shanks('OP01-120-PAR'))).toBe('parallel')
    expect(ligaTreatmentKey(shanks('OP01-120-E-PAR'))).toBeNull()
  })

  /* A ST04-011: a mesma Tournament Pack, de participante e de vencedor. */
  it('os colchetes separam a identidade, mas não o tratamento', () => {
    const maria = (card: string, num: string) =>
      art({ variantId: '1', cardCode: 'ST04-011', cardName: 'Black Maria', ligaUrl: liga(card, num, 'PC-01') })
    const participante = maria('Black Maria (Tournament Pack Vol. 2) (ST04-011-TP)', 'ST04-011-TP')
    const vencedor = maria('Black Maria (Tournament Pack Vol. 2) [Winner] (ST04-011-TW)', 'ST04-011-TW')

    expect(ligaIdentity(participante).chave).toBe('tournament pack vol 2')
    expect(ligaIdentity(vencedor).chave).toBe('tournament pack vol 2 [winner]')
    expect(ligaTreatmentKey(vencedor)).toBe('tournament pack vol 2')
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

describe('os sinônimos aprovados (decisão 074)', () => {
  const chave = (card: string, num: string, ed: string, cardName: string, over: Partial<LigaArt> = {}) =>
    ligaTreatmentKey(art({ variantId: '1', cardName, ligaUrl: liga(card, num, ed), ...over }))

  it('SPR é SP, Pandaman é Pandaman Art, Extended Art é Full Art', () => {
    expect(chave('Yamato (SPR) (OP06-022)', 'OP06-022', 'EB02', 'Yamato')).toBe('sp')
    expect(chave('Kyo (Pandaman) (OP17-045-PA)', 'OP17-045-PA', 'OP-17', 'Kyo')).toBe('pandaman art')
    expect(chave('Izo (033) (Extended Art) (OP01-033-EA)', 'OP01-033-EA', 'PRB', 'Izo')).toBe('full art')
  })

  /* So a parte inteira: SP + Gold nao vira outra coisa. */
  it('não mexe em combinação', () => {
    expect(chave('Nami (SP) (Gold) (OP01-016-SG)', 'OP01-016-SG', 'OP-05', 'Nami')).toBe('gold + sp')
  })

  it('a reimpressão da PRB-01 vale Jolly Roger Foil, e a da PRB-02, Pirate Foil', () => {
    expect(
      chave('Blast Breath (Reprint) (ST04-016-RE)', 'ST04-016-RE', 'PRB', 'Blast Breath', { parallelSets: ['PRB-01'], normalSets: ['ST-04', 'PRB-01'] }),
    ).toBe('jolly roger foil')
    expect(
      chave('Mountain God (Reprint) (EB01-018-RE)', 'EB01-018-RE', 'PRB2', 'Mountain God', { parallelSets: ['PRB-02'], normalSets: ['EB-01', 'PRB-02'] }),
    ).toBe('pirate foil')
  })

  it('o "(ST17)" diz de onde a carta é, e não o tratamento', () => {
    expect(chave('Trafalgar Law (ST17) (Alternate Art) (ST17-002-AA)', 'ST17-002-AA', 'PRB2', 'Trafalgar Law')).toBe('alternate art')
  })
})

describe('o tratamento do produto, sem o pedaço do nome', () => {
  /* O TCGplayer escreve `Miss Doublefinger(Zala) (Full Art)`: o Zala e do nome. */
  it('tira a parte que é pedaço do nome da carta', () => {
    expect(sourceTreatmentKey('Zala + Full Art', 'Miss Doublefinger(Zala)')).toBe('full art')
    expect(sourceTreatmentKey('Galdino + Alternate Art', 'Mr.3(Galdino)')).toBe('alternate art')
  })

  /* `Gol D. Roger` contem `gold`: palavra do vocabulario de arte nunca sai. */
  it('nunca tira uma palavra do vocabulário de arte', () => {
    expect(sourceTreatmentKey('SP + Gold', 'Gol.D.Roger Gold')).toBe('gold + sp')
  })
})
