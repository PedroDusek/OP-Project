import { describe, expect, it } from 'vitest'
import { cardWidthFor, deckSections, sheetHeight, type DeckSheet } from '@/lib/deck-sheet-image'

/**
 * A folha da decklist (pedido do dono do produto em 23/11).
 *
 * O `canvas` não existe no jsdom, então o desenho em si não se testa aqui — o
 * que se protege é o que decide **a forma**: quais seções existem, em que ordem
 * as cartas saem dentro de cada uma, e que a imagem cresce com a lista. É o que
 * quebraria em silêncio, porque ninguém olha uma imagem byte a byte.
 */

const carta = (
  cardCode: string,
  type: string,
  cost: number | null,
  copies = 1,
): DeckSheet['cards'][number] => ({
  cardCode,
  cardName: `Carta ${cardCode}`,
  type,
  cost,
  copies,
  sheetImageUrl: null,
})

const deck = (cards: DeckSheet['cards']): DeckSheet => ({
  name: 'Sabo Vermelho',
  leader: { ...carta('OP13-004', 'Leader', null), colors: ['Vermelho'] },
  cards,
})

describe('as seções da folha', () => {
  it('o líder vem primeiro, sozinho na própria seção', () => {
    const secoes = deckSections(deck([carta('OP01-001', 'Character', 3)]))

    expect(secoes[0].titulo).toBe('Líder')
    expect(secoes[0].cartas.map((c) => c.cardCode)).toEqual(['OP13-004'])
  })

  it('personagens, eventos e stages, nessa ordem', () => {
    const secoes = deckSections(
      deck([
        carta('OP01-010', 'Stage', 2),
        carta('OP01-020', 'Event', 1),
        carta('OP01-001', 'Character', 3),
      ]),
    )

    expect(secoes.map((s) => s.titulo)).toEqual(['Líder', 'Personagens', 'Eventos', 'Stages'])
  })

  /* Uma lista sem stage não precisa dizer que não tem. */
  it('seção sem carta não aparece', () => {
    const secoes = deckSections(deck([carta('OP01-001', 'Character', 3)]))

    expect(secoes.map((s) => s.titulo)).toEqual(['Líder', 'Personagens'])
  })

  /* É como as listas são publicadas, e o que deixa comparar curvas de olho. */
  it('dentro da seção, por custo — e o código desempata', () => {
    const secoes = deckSections(
      deck([
        carta('OP01-050', 'Character', 5),
        carta('OP01-002', 'Character', 1),
        carta('OP01-001', 'Character', 1),
        carta('OP01-030', 'Character', 3),
      ]),
    )

    expect(secoes[1].cartas.map((c) => c.cardCode)).toEqual([
      'OP01-001',
      'OP01-002',
      'OP01-030',
      'OP01-050',
    ])
  })

  /* Custo nulo não some nem embaralha: vai para o fim da própria seção. */
  it('carta sem custo vai para o fim da seção', () => {
    const secoes = deckSections(
      deck([carta('OP01-099', 'Character', null), carta('OP01-001', 'Character', 7)]),
    )

    expect(secoes[1].cartas.map((c) => c.cardCode)).toEqual(['OP01-001', 'OP01-099'])
  })

  /**
   * Sumir seria entregar uma decklist incompleta sem ninguém ver — o mesmo
   * princípio da carta sem vínculo na folha da want list.
   */
  it('tipo que a fonte inventar não some: vira seção própria, no fim', () => {
    const secoes = deckSections(
      deck([carta('OP99-001', 'Tesouro', 2), carta('OP01-001', 'Character', 3)]),
    )

    expect(secoes.map((s) => s.titulo)).toEqual(['Líder', 'Personagens', 'Tesouro'])
    expect(secoes[2].cartas.map((c) => c.cardCode)).toEqual(['OP99-001'])
  })
})

describe('a altura da imagem', () => {
  const altura = (cards: DeckSheet['cards']) =>
    sheetHeight(deckSections(deck(cards)), Math.round(cardWidthFor() * (7 / 5)))

  it('cresce quando a lista ganha uma fileira', () => {
    const quatro = Array.from({ length: 4 }, (_, i) => carta(`OP01-00${i}`, 'Character', i))
    const cinco = [...quatro, carta('OP01-009', 'Character', 9)]

    expect(altura(cinco)).toBeGreaterThan(altura(quatro))
  })

  /*
   * Quatro colunas: a quarta carta ainda cabe na mesma fileira, então a imagem
   * nao muda de tamanho entre tres e quatro.
   */
  it('não cresce enquanto a fileira não enche', () => {
    const tres = Array.from({ length: 3 }, (_, i) => carta(`OP01-00${i}`, 'Character', i))
    const quatro = [...tres, carta('OP01-004', 'Character', 4)]

    expect(altura(quatro)).toBe(altura(tres))
  })

  /**
   * Uma decklist inteira numa imagem só (pedido do dono do produto em 23/11).
   *
   * Cinquenta cartas em dezessete linhas distintas — uma lista plausível, com
   * quatro cópias da maioria. A want list recusa a imagem única porque cem
   * cartas passariam de sete mil pixels; aqui são cerca de três mil, e este
   * teste é o número que sustenta a afirmação em vez de repeti-la.
   */
  it('uma decklist de verdade cabe em cerca de tres mil pixels', () => {
    const linhas = [
      ...Array.from({ length: 12 }, (_, i) => carta(`OP01-1${i}`, 'Character', i % 9, 4)),
      ...Array.from({ length: 5 }, (_, i) => carta(`OP01-2${i}`, 'Event', i % 4, 2)),
    ]

    const copias = linhas.reduce((total, c) => total + c.copies, 0)
    expect(copias).toBe(58)
    // 3.034 px medidos: seis fileiras de quatro, mais os titulos de secao.
    expect(altura(linhas)).toBeLessThan(3200)
  })
})
