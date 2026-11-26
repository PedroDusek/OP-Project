import { describe, expect, it } from 'vitest'
import {
  missingForDeck,
  STARTER_DECK_CARDS,
  validateStarterDecks,
} from '@/server/domain/catalog/starter-decks'

/**
 * A tabela de composição dos starter decks (decisão 116).
 *
 * O catálogo sabe **quais** cartas saem em cada ST; nenhuma fonte legível diz
 * **quantas de cada**. Esta tabela guarda o que gente conferiu, e a validação é
 * o que impede um número não conferido de chegar à coleção de alguém.
 */

const deck = (cartas: [string, number][], code = 'ST-01') => [
  { deck: code, cartas: cartas.map(([carta, copias]) => ({ carta, copias })) },
]

/** Dez cartas a 4 e cinco a 2: 50. É a forma de quase todo ST. */
const CINQUENTA: [string, number][] = [
  ['ST01-002', 4], ['ST01-003', 4], ['ST01-004', 4], ['ST01-005', 4], ['ST01-006', 4],
  ['ST01-007', 4], ['ST01-008', 4], ['ST01-009', 4], ['ST01-010', 4], ['ST01-011', 4],
  ['ST01-012', 2], ['ST01-013', 2], ['ST01-014', 2], ['ST01-015', 2], ['ST01-016', 2],
]

describe('a soma de 50', () => {
  it('aceita o deck que fecha', () => {
    expect(validateStarterDecks(deck(CINQUENTA))[0].cartas).toHaveLength(15)
  })

  /**
   * **É a razão de a tabela valer alguma coisa.** Um erro de digitação que some
   * 48 descreve um produto que não existe, e ele entraria na coleção de quem
   * clicasse em "Adicionar ST". Medido em 25/11: de 31 listas trazidas de fora,
   * **13 tinham erro estrutural** — três delas erravam só a soma.
   */
  it('recusa o que soma menos', () => {
    const faltando: [string, number][] = [...CINQUENTA.slice(0, 14), ['ST01-016', 1]]

    expect(() => validateStarterDecks(deck(faltando))).toThrow(/soma 49/)
  })

  it('recusa o que soma mais', () => {
    const sobrando: [string, number][] = [...CINQUENTA, ['ST01-017', 2]]

    expect(() => validateStarterDecks(deck(sobrando))).toThrow(/soma 52/)
  })

  it('recusa o deck vazio: zero não é cinquenta', () => {
    expect(() => validateStarterDecks(deck([]))).toThrow(/soma 0/)
  })
})

describe('as cópias de cada carta', () => {
  it('recusa mais de quatro, como o deck construído', () => {
    const demais: [string, number][] = [['ST01-002', 5], ...CINQUENTA.slice(1)]

    expect(() => validateStarterDecks(deck(demais))).toThrow(/5 cópias/)
  })

  it('recusa zero: a ausência é não estar na lista', () => {
    const zero: [string, number][] = [['ST01-002', 0], ...CINQUENTA.slice(1)]

    expect(() => validateStarterDecks(deck(zero))).toThrow(/0 cópias/)
  })

  it('recusa fração', () => {
    const quebrado: [string, number][] = [['ST01-002', 2.5], ...CINQUENTA.slice(1)]

    expect(() => validateStarterDecks(deck(quebrado))).toThrow(/2.5 cópias/)
  })
})

describe('o que não pode se repetir', () => {
  /*
   * Recusa em vez de consertar, como a tabela dos DON!!: uma carta duas vezes
   * com números diferentes nao tem resposta certa, e escolher uma em silencio
   * gravaria um numero que ninguem conferiu.
   */
  it('recusa a mesma carta duas vezes', () => {
    const repetida: [string, number][] = [['ST01-002', 2], ['ST01-002', 2], ...CINQUENTA.slice(1)]

    expect(() => validateStarterDecks(deck(repetida))).toThrow(/repete a carta ST01-002/)
  })

  it('recusa o mesmo deck duas vezes', () => {
    const dois = [...deck(CINQUENTA), ...deck(CINQUENTA)]

    expect(() => validateStarterDecks(dois)).toThrow(/ST-01 aparece mais de uma vez/)
  })

  it('recusa entrada sem deck', () => {
    expect(() => validateStarterDecks(deck(CINQUENTA, '   '))).toThrow(/sem deck/)
  })
})

/**
 * O arquivo vai para PR, e diff de ordem esconde diff de valor. Ordenar na
 * gravação é o que faz uma mudança de número aparecer sozinha na revisão.
 */
describe('a ordem estável', () => {
  it('ordena as cartas pelo código', () => {
    const fora: [string, number][] = [...CINQUENTA].reverse()

    expect(validateStarterDecks(deck(fora))[0].cartas[0].carta).toBe('ST01-002')
  })

  it('ordena os decks pelo código', () => {
    const fora = [...deck(CINQUENTA, 'ST-09'), ...deck(CINQUENTA, 'ST-02')]

    expect(validateStarterDecks(fora).map((d) => d.deck)).toEqual(['ST-02', 'ST-09'])
  })

  it('tira o espaço em volta do código', () => {
    expect(validateStarterDecks(deck(CINQUENTA, ' ST-01 '))[0].deck).toBe('ST-01')
  })
})

describe('missingForDeck', () => {
  it('conta o que falta para 50', () => {
    expect(missingForDeck([{ copias: 4 }, { copias: 4 }])).toBe(STARTER_DECK_CARDS - 8)
  })

  it('negativo quando passou', () => {
    expect(missingForDeck(Array.from({ length: 13 }, () => ({ copias: 4 })))).toBe(-2)
  })

  it('ignora quantidade negativa, que é rascunho e não dívida', () => {
    expect(missingForDeck([{ copias: 4 }, { copias: -3 }])).toBe(STARTER_DECK_CARDS - 4)
  })
})
