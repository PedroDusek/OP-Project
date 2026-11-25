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

  /**
   * **A regra mudou em 23/11.** A folha tinha uma seção por tipo, escrita:
   * "Personagens · 37", "Eventos · 11", "Stages · 2". O dono do produto tirou
   * para economizar espaço — cada título custa uma linha, e cada grupo que
   * termina no meio de uma fileira deixa o resto dela vazia.
   *
   * A **ordem** continua a mesma; o que sumiu foi dizê-la em voz alta.
   */
  it('o deck vem numa fila só, sem título de tipo', () => {
    const secoes = deckSections(
      deck([
        carta('OP01-010', 'Stage', 2),
        carta('OP01-020', 'Event', 1),
        carta('OP01-001', 'Character', 3),
      ]),
    )

    expect(secoes.map((s) => s.titulo)).toEqual(['Líder', null])
  })

  it('e a fila sai na ordem de quem joga: personagem, evento, stage', () => {
    const secoes = deckSections(
      deck([
        carta('OP01-010', 'Stage', 2),
        carta('OP01-020', 'Event', 1),
        carta('OP01-001', 'Character', 3),
      ]),
    )

    expect(secoes[1].cartas.map((c) => c.type)).toEqual(['Character', 'Event', 'Stage'])
  })

  /* Lista sem carta nenhuma é só o líder: uma fila vazia não vira seção. */
  it('deck vazio deixa só o líder', () => {
    expect(deckSections(deck([])).map((s) => s.titulo)).toEqual(['Líder'])
  })

  /* É como as listas são publicadas, e o que deixa comparar curvas de olho. */
  it('dentro do tipo, por custo — e o código desempata', () => {
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
   *
   * Com a fila única (23/11) ele deixou de virar seção e passou a ir para o
   * fim da fila, que é o mesmo lugar por outro meio.
   */
  it('tipo que a fonte inventar não some: vai para o fim da fila', () => {
    const secoes = deckSections(
      deck([
        carta('OP99-001', 'Tesouro', 2),
        carta('OP01-050', 'Stage', 1),
        carta('OP01-001', 'Character', 3),
      ]),
    )

    expect(secoes[1].cartas.map((c) => c.cardCode)).toEqual([
      'OP01-001',
      'OP01-050',
      'OP99-001',
    ])
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
    // 2.966 px medidos: seis fileiras de quatro, mais o titulo do lider.
    // Eram 3.034 com uma secao por tipo, ate 23/11.
    expect(altura(linhas)).toBeLessThan(3000)
  })
})

/**
 * O aviso do líder de evento selado viaja junto com a imagem (decisão 115).
 *
 * A folha sai do produto e vai para um grupo, onde ninguém vê a tela do Deck
 * Builder que dá o aviso. Uma lista que parece construída e é recusada na mesa
 * é pior que nenhuma.
 */
describe('o líder de evento selado na folha', () => {
  const comLider = (cardCode: string): DeckSheet => ({
    name: 'Selado',
    leader: { ...carta(cardCode, 'Leader', null), colors: ['Red', 'Green'] },
    cards: [carta('OP01-001', 'Character', 3)],
  })

  it('o título da seção do líder leva o aviso', () => {
    expect(deckSections(comLider('SB-712746'))[0].titulo).toBe('Líder · só em evento designado')
  })

  it('um líder comum continua só "Líder"', () => {
    expect(deckSections(comLider('OP13-004'))[0].titulo).toBe('Líder')
  })

  /* O aviso é texto no título: a folha não ganha seção nem fileira por causa dele. */
  it('o aviso não muda a forma da folha', () => {
    const selado = deckSections(comLider('SB-712746'))
    const comum = deckSections(comLider('OP13-004'))

    expect(selado).toHaveLength(comum.length)
    expect(sheetHeight(selado, 300)).toBe(sheetHeight(comum, 300))
  })
})
