import { describe, expect, it } from 'vitest'
import {
  assertDeckRules,
  copiesByCode,
  DECK_SIZE,
  deckTotal,
  distributeOwned,
  fitsLeader,
  MAX_COPIES_PER_CARD,
} from '@/server/domain/decks/deck'
import { ValidationError } from '@/server/domain/errors'

/** As regras do deck (decisão 095). */

const linha = (variantId: string, cardCode: string, copies: number) => ({ variantId, cardCode, copies })

describe('a cor do líder', () => {
  it('a carta precisa ter alguma cor do líder', () => {
    expect(fitsLeader(['Red'], ['Red'])).toBe(true)
    expect(fitsLeader(['Red'], ['Blue'])).toBe(false)
  })

  it('líder de duas cores aceita as duas, e carta de duas cores entra por uma delas', () => {
    expect(fitsLeader(['Red', 'Green'], ['Green'])).toBe(true)
    expect(fitsLeader(['Red', 'Green'], ['Blue', 'Green'])).toBe(true)
    expect(fitsLeader(['Red', 'Green'], ['Blue', 'Purple'])).toBe(false)
  })
})

describe('as contagens', () => {
  it('soma as cópias por código, mesmo em artes diferentes', () => {
    const lines = [linha('1', 'OP01-016', 2), linha('2', 'OP01-016', 2), linha('3', 'OP01-025', 1)]
    expect(copiesByCode(lines)).toEqual(new Map([['OP01-016', 4], ['OP01-025', 1]]))
    expect(deckTotal(lines)).toBe(5)
  })
})

describe('o que o deck recusa', () => {
  it('passa das quatro cópias da mesma carta, somando as artes', () => {
    expect(MAX_COPIES_PER_CARD).toBe(4)
    const lines = [linha('1', 'OP01-016', 3), linha('2', 'OP01-016', 2)]
    expect(() => assertDeckRules(lines)).toThrow(ValidationError)
    expect(() => assertDeckRules(lines)).toThrow(/OP01-016/)
  })

  it('quatro cópias em duas artes passa', () => {
    expect(() => assertDeckRules([linha('1', 'OP01-016', 3), linha('2', 'OP01-016', 1)])).not.toThrow()
  })

  it('passa de cinquenta cartas', () => {
    expect(DECK_SIZE).toBe(50)
    const lines = Array.from({ length: 13 }, (_, i) => linha(String(i), `OP01-${i}`, 4))
    expect(deckTotal(lines)).toBe(52)
    expect(() => assertDeckRules(lines)).toThrow(/50 cartas/)
  })

  it('cópia zero ou quebrada', () => {
    expect(() => assertDeckRules([linha('1', 'OP01-016', 0)])).toThrow(ValidationError)
    expect(() => assertDeckRules([linha('1', 'OP01-016', 1.5)])).toThrow(ValidationError)
  })
})

describe('repartir o que a pessoa tem', () => {
  const lines = [linha('normal', 'OP01-016', 2), linha('alternativa', 'OP01-016', 2)]

  it('auto completar desligado: só a arte exata cobre a linha', () => {
    const porVariante = new Map([['normal', 3]])
    const porCodigo = new Map([['OP01-016', 3]])

    expect(distributeOwned(lines, porVariante, porCodigo, false)).toEqual([
      { owned: 2, missing: 0 },
      { owned: 0, missing: 2 },
    ])
  })

  it('auto completar ligado: as cópias de qualquer arte cobrem as primeiras linhas', () => {
    const porVariante = new Map([['normal', 3]])
    const porCodigo = new Map([['OP01-016', 3]])

    expect(distributeOwned(lines, porVariante, porCodigo, true)).toEqual([
      { owned: 2, missing: 0 },
      { owned: 1, missing: 1 },
    ])
  })

  it('não conta a mesma cópia duas vezes', () => {
    const porCodigo = new Map([['OP01-016', 1]])
    const reparte = distributeOwned(lines, new Map(), porCodigo, true)
    expect(reparte.reduce((soma, linha) => soma + linha.owned, 0)).toBe(1)
  })

  it('quem não tem nada, falta tudo', () => {
    expect(distributeOwned(lines, new Map(), new Map(), true)).toEqual([
      { owned: 0, missing: 2 },
      { owned: 0, missing: 2 },
    ])
  })
})
