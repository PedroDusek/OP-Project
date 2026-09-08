import { describe, expect, it } from 'vitest'
import {
  WANT_STATUS_LABEL,
  matchQuantity,
  remainingToGet,
  wantStatus,
} from '@/server/domain/wants/status'

/**
 * A aritmetica de want.
 *
 * Um want e variante e quantidade (`business-rules.md` 4.4) — sem prioridade e
 * sem anotacao. Toda a regra cabe em tres funcoes, e e melhor assim: elas sao o
 * que a tela de matches vai usar depois, sem banco no meio.
 */

describe('quanto ainda falta', () => {
  it('e a diferenca entre o desejado e o possuido', () => {
    expect(remainingToGet(0, 4)).toBe(4)
    expect(remainingToGet(2, 4)).toBe(2)
  })

  /** Ter mais do que se queria nao e divida ao contrario. */
  it('nunca e negativo', () => {
    expect(remainingToGet(6, 4)).toBe(0)
  })

  it('ignora quantidade possuida negativa', () => {
    expect(remainingToGet(-3, 2)).toBe(2)
  })
})

describe('o estado do want', () => {
  /**
   * Tres estados, e nao dois: "tenho" e "nao tenho" perderiam o caso mais comum
   * de quem monta playset, que e querer quatro e ter duas.
   */
  it('separa nao ter, ter algumas e ja ter conseguido', () => {
    expect(wantStatus(0, 4)).toBe('missing')
    expect(wantStatus(2, 4)).toBe('partial')
    expect(wantStatus(4, 4)).toBe('satisfied')
  })

  it('ter mais do que queria tambem e conseguido', () => {
    expect(wantStatus(9, 4)).toBe('satisfied')
  })

  /** Querer zero nao e um want pendente. */
  it('querer zero ja esta satisfeito', () => {
    expect(wantStatus(0, 0)).toBe('satisfied')
  })

  it('tem um rotulo para cada estado', () => {
    expect(Object.keys(WANT_STATUS_LABEL).sort()).toEqual(['missing', 'partial', 'satisfied'])
  })
})

describe('o que um match cobre', () => {
  /** `MIN(disponivel, desejado)` — `business-rules.md` 4.3. */
  it('e o minimo entre o disponivel e o que falta', () => {
    expect(matchQuantity(3, 2)).toBe(2)
    expect(matchQuantity(1, 4)).toBe(1)
  })

  it('e zero quando um dos lados e zero', () => {
    expect(matchQuantity(0, 4)).toBe(0)
    expect(matchQuantity(4, 0)).toBe(0)
  })

  it('nunca devolve negativo', () => {
    expect(matchQuantity(-2, 4)).toBe(0)
    expect(matchQuantity(4, -2)).toBe(0)
  })
})
