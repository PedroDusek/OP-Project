import { describe, expect, it } from 'vitest'
import { PARAM } from '@/lib/catalog-params'
import { deckCatalogQuery } from '@/lib/deck-query'

/**
 * Os filtros do catálogo dentro das travas do deck (decisão 095).
 *
 * Pedido do dono do produto: buscar com os filtros que o catálogo já tem, sem
 * digitar código. O que se protege aqui é que o filtro nunca fura a regra.
 */

const DECK = ['Character', 'Event', 'Stage']
const params = (query: string | null) => new URLSearchParams(query ?? '')

describe('deckCatalogQuery', () => {
  it('sem filtro, pede os tipos do deck e as cores do líder', () => {
    const q = params(deckCatalogQuery({}, '', DECK, ['Red', 'Green']))
    expect(q.getAll('type')).toEqual(DECK)
    expect(q.getAll('color')).toEqual(['Red', 'Green'])
    expect(q.get('pageSize')).toBe('12')
  })

  it('leva os outros filtros do catálogo junto', () => {
    const q = params(
      deckCatalogQuery(
        { [PARAM.custoMin]: '3', [PARAM.custoMax]: '5', [PARAM.trait]: 'Straw Hat Crew', [PARAM.set]: 'OP-01' },
        'Zoro',
        DECK,
        ['Red'],
      ),
    )
    expect(q.get('search')).toBe('Zoro')
    expect(q.get('costMin')).toBe('3')
    expect(q.get('costMax')).toBe('5')
    expect(q.getAll('trait')).toEqual(['Straw Hat Crew'])
    expect(q.get('setCode')).toBe('OP-01')
  })

  it('a cor escolhida é cruzada com a do líder', () => {
    const q = params(deckCatalogQuery({ [PARAM.cor]: ['Red', 'Blue'] }, '', DECK, ['Red', 'Green']))
    expect(q.getAll('color')).toEqual(['Red'])
  })

  it('cor que o líder não tem dá nada, e não uma carta que o servidor recusaria', () => {
    expect(deckCatalogQuery({ [PARAM.cor]: 'Blue' }, '', DECK, ['Red'])).toBeNull()
  })

  it('o tipo escolhido é cruzado com os do deck: pedir Leader na etapa das cartas dá nada', () => {
    expect(params(deckCatalogQuery({ [PARAM.tipo]: 'Event' }, '', DECK, ['Red'])).getAll('type')).toEqual(['Event'])
    expect(deckCatalogQuery({ [PARAM.tipo]: 'Leader' }, '', DECK, ['Red'])).toBeNull()
  })

  it('na etapa do líder, só Leader, de qualquer cor', () => {
    const q = params(deckCatalogQuery({ [PARAM.cor]: 'Purple' }, '', ['Leader'], undefined))
    expect(q.getAll('type')).toEqual(['Leader'])
    expect(q.getAll('color')).toEqual(['Purple'])
  })
})
