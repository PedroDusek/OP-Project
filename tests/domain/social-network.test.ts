import { describe, expect, it } from 'vitest'
import { ValidationError } from '@/server/domain/errors'
import {
  clampNetworkPage,
  compareNetworkMembers,
  NETWORK_MAX_PAGES,
  normalizeNetworkQuery,
  normalizeReportReason,
  previewCards,
  REPORT_REASON_MAX,
} from '@/server/domain/social/network'

/** A ordem, a prévia e os limites da rede (regra 6.1.3, decisões 060 e 079). */

describe('a ordem da rede', () => {
  it('Premium primeiro, depois o interesse, depois o nome', () => {
    const pessoas = [
      { username: 'bia', premium: false, interest: 1 },
      { username: 'ana', premium: false, interest: 1 },
      { username: 'caio', premium: false, interest: 3 },
      { username: 'zeca', premium: true, interest: 0 },
    ]
    expect([...pessoas].sort(compareNetworkMembers).map((p) => p.username)).toEqual(['zeca', 'caio', 'ana', 'bia'])
  })
})

describe('a página e a busca', () => {
  /* Sem teto, paginar e raspar devagar (decisao 060). */
  it('a página fica entre a primeira e o teto', () => {
    expect(clampNetworkPage(null)).toBe(1)
    expect(clampNetworkPage('abc')).toBe(1)
    expect(clampNetworkPage('0')).toBe(1)
    expect(clampNetworkPage('3')).toBe(3)
    expect(clampNetworkPage('9999')).toBe(NETWORK_MAX_PAGES)
  })

  it('busca curta demais é não buscar', () => {
    expect(normalizeNetworkQuery('  z ')).toBeNull()
    expect(normalizeNetworkQuery('  roronoa   zoro ')).toBe('roronoa zoro')
  })
})

describe('a prévia', () => {
  const cartas = ['a', 'b', 'c', 'd'].map((variantId) => ({ variantId }))

  it('sem busca, o que quem olha procura vem primeiro, e o resto na ordem', () => {
    expect(previewCards(cartas, { wanted: new Set(['d']) }, 3).map((c) => c.variantId)).toEqual(['d', 'a', 'b'])
  })

  /* Medido nos dados locais: uma want list grande enchia as vagas antes da carta buscada. */
  it('com busca, o que casa vem antes do que quem olha procura', () => {
    expect(
      previewCards(cartas, { wanted: new Set(['a', 'b', 'd']), matching: new Set(['c']) }, 3).map((c) => c.variantId),
    ).toEqual(['c', 'a', 'b'])
  })
})

describe('o motivo da denúncia', () => {
  it('é obrigatório e tem teto', () => {
    expect(() => normalizeReportReason('  ')).toThrow(ValidationError)
    expect(() => normalizeReportReason('x'.repeat(REPORT_REASON_MAX + 1))).toThrow(ValidationError)
    expect(normalizeReportReason('  golpe  ')).toBe('golpe')
  })
})
