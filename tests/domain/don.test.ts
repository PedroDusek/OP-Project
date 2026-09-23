import { describe, expect, it } from 'vitest'
import { donCardCode, donVariantType, isDonCode } from '@/server/domain/catalog/don'
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
