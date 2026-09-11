import { describe, expect, it } from 'vitest'
import { countActiveFilters, PARAM, toApiQuery, toCatalogQuery } from '@/lib/catalog-params'

/**
 * O counter na URL e no caminho ate a API.
 *
 * O filtro vive na URL como os outros (`?contador=0&contador=2000`), e a rolagem
 * infinita repassa para a API. Um elo esquecido nesse caminho faria a primeira
 * pagina vir filtrada e as seguintes nao — e ninguem perceberia ate rolar.
 */

describe('o parametro contador', () => {
  it('e em portugues, como os outros', () => {
    expect(PARAM.contador).toBe('contador')
  })

  it('vira a lista de valores que a busca entende', () => {
    expect(toCatalogQuery({ contador: ['0', '2000'] }).counter).toEqual([0, 2000])
    expect(toCatalogQuery({ contador: '1000' }).counter).toEqual([1000])
  })

  /* `contador=500` numa URL editada a mao e "sem filtro", nao "sem counter". */
  it('descarta o que nao e um dos tres valores', () => {
    expect(toCatalogQuery({ contador: '500' }).counter).toBeUndefined()
    expect(toCatalogQuery({ contador: ['500', '1000'] }).counter).toEqual([1000])
    expect(toCatalogQuery({}).counter).toBeUndefined()
  })

  it('conta cada valor marcado no distintivo de filtros', () => {
    expect(countActiveFilters({ contador: ['0', '1000'] })).toBe(2)
  })

  /* A rolagem infinita pede as paginas seguintes pela API. */
  it('segue para a API com o nome que ela aceita', () => {
    const query = new URLSearchParams(toApiQuery({ counter: [0, 2000] }))
    expect(query.getAll('counter')).toEqual(['0', '2000'])
  })

  it('nao manda nada para a API quando nao ha filtro', () => {
    expect(new URLSearchParams(toApiQuery({})).has('counter')).toBe(false)
  })
})
