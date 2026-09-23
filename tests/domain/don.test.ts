import { describe, expect, it } from 'vitest'
import { donCardCode, donVariantType, isDonCode, DON_SET_CODE } from '@/server/domain/catalog/don'
import { compareSetsForCatalog, setKind, SET_KIND_LABEL } from '@/server/domain/catalog/sets'
import { ligaEdition } from '@/server/domain/catalog/liga'
import { CARD_TYPES, DON_TYPE } from '@/server/domain/catalog/types'
import { parseCardList } from '@/server/domain/catalog/parse-card-list'

/**
 * O DON!! como tipo de carta (decisão 112).
 *
 * Ele não vem da Bandai: o catálogo oficial é a lista de cartas de deck, e o
 * DON!! não é uma delas. Entra pelo tcgcsv, e por isso precisa de identidade
 * própria — a fonte não dá código.
 */

describe('o código inventado do DON', () => {
  it('sai do productId do TCGplayer', () => {
    expect(donCardCode(482236)).toBe('DON-482236')
    expect(donCardCode('711420')).toBe('DON-711420')
  })

  /* `cards.code` e VARCHAR(20): o codigo precisa caber com folga. */
  it('cabe no campo do banco', () => {
    // O maior productId visto na fonte tem 6 digitos; 10 e folga de sobra.
    expect(donCardCode(9999999999).length).toBeLessThanOrEqual(20)
  })

  it('se reconhece sem precisar ler o tipo no banco', () => {
    expect(isDonCode('DON-482236')).toBe(true)
    expect(isDonCode('don-482236')).toBe(true)
    expect(isDonCode('OP01-001')).toBe(false)
    // Nao confundir com uma carta cujo nome comeca com DON.
    expect(isDonCode('OP05-069')).toBe(false)
  })
})

describe('a arte do DON', () => {
  /*
   * A fonte nao separa arte comum de alternativa em campo proprio — so no nome
   * do produto. "DON!! Card" e a que vem nos decks; o resto tem mercado.
   */
  it('a carta lisa e Normal, inclusive em dourado', () => {
    expect(donVariantType('DON!! Card')).toBe('Normal')
    expect(donVariantType('DON!! Card (Gold)')).toBe('Normal')
  })

  it('qualquer arte com personagem ou marca e Parallel', () => {
    expect(donVariantType('DON!! Card (Luffy)')).toBe('Parallel')
    expect(donVariantType('DON!! Card (Alternate Art)')).toBe('Parallel')
    expect(donVariantType('DON!! Card (Alternate Art) (Rocks) (Special Foil)')).toBe('Parallel')
  })
})

describe('o DON no vocabulário de tipos', () => {
  it('e um tipo de carta como os outros quatro', () => {
    expect(CARD_TYPES).toContain(DON_TYPE)
    expect(CARD_TYPES).toEqual(['Leader', 'Character', 'Event', 'Stage', 'DON'])
  })

  /*
   * Mas o parser da Bandai nao pode aceita-lo. La o DON!! nao existe — conferido
   * em 23/09 pela busca do proprio site —, e aceitar o rotulo abriria a porta
   * para um tipo novo da fonte entrar calado no dia em que ela mudasse.
   */
  it('o parser da Bandai continua recusando um bloco de tipo DON', () => {
    const html = `
      <dl class="modalCol" id="OP01-999">
        <div class="infoCol"><span>OP01-999</span><span>C</span><span>DON</span></div>
        <div class="cardName">DON!! Card</div>
      </dl>`

    const page = parseCardList(html)

    expect(page.cards).toHaveLength(0)
    expect(page.rejected).toEqual([
      { sourceId: 'OP01-999', reason: 'tipo de carta nao reconhecido: DON' },
    ])
  })
})

/**
 * O set artificial (decisão 112, escolha do dono do produto).
 *
 * Ele não existe na Bandai. A primeira versão deixou os DON!! sem set nenhum;
 * o dono do produto pediu o set para que a pessoa os visse separados no
 * catálogo — e ele também é o que faz a planilha de conferência da Liga, que é
 * por coleção, alcançar os 239.
 */
describe('o set artificial DON', () => {
  it('tem espécie própria, e nao se passa por colecao', () => {
    expect(setKind(DON_SET_CODE)).toBe('don')
    expect(SET_KIND_LABEL.don).toBe('DON!!')
  })

  /* Por ultimo na ordem: e a gaveta propria, e nao algo que sai em booster. */
  it('ordena depois de colecao, starter deck e promo', () => {
    expect(compareSetsForCatalog(DON_SET_CODE, 'OP01')).toBeGreaterThan(0)
    expect(compareSetsForCatalog(DON_SET_CODE, 'ST-01')).toBeGreaterThan(0)
    expect(compareSetsForCatalog(DON_SET_CODE, 'PROMO')).toBeGreaterThan(0)
    expect(compareSetsForCatalog('OP01', DON_SET_CODE)).toBeLessThan(0)
  })

  /*
   * O codigo do set nao pode virar edicao da Liga: `DON` nao tem digitos, entao
   * `ligaEdition` nao o reconhece — e o link direto nunca e montado.
   */
  it('nao produz edicao da Liga', () => {
    expect(ligaEdition(DON_SET_CODE)).toBeNull()
  })
})
