import { describe, expect, it } from 'vitest'
import {
  buildCatalogHref,
  countActiveFilters,
  PARAM,
  toCatalogQuery,
} from '@/lib/catalog-params'

/**
 * Os filtros do catalogo vivem na URL. O que se garante aqui e a traducao entre
 * a query string, que qualquer pessoa pode editar a mao, e o que o caso de uso
 * recebe.
 */

describe('toCatalogQuery', () => {
  it('traduz os nomes em portugues para o vocabulario interno', () => {
    const query = toCatalogQuery({
      q: 'luffy',
      tipo: 'Character',
      cor: 'Red',
      raridade: 'SR',
      variante: 'Parallel',
      atributo: 'Strike',
      mecanica: 'Rush',
      trait: 'Straw Hat Crew',
      custoMin: '2',
      custoMax: '5',
      pagina: '3',
    })

    expect(query).toMatchObject({
      search: 'luffy',
      type: 'Character',
      color: 'Red',
      rarity: 'SR',
      variantType: 'Parallel',
      attribute: 'Strike',
      mechanic: 'Rush',
      trait: 'Straw Hat Crew',
      costMin: 2,
      costMax: 5,
      page: 3,
    })
  })

  it('comeca na pagina 1 quando nao ha pagina', () => {
    expect(toCatalogQuery({}).page).toBe(1)
  })

  /**
   * A URL e editavel a mao. Texto onde se espera numero vira "sem filtro", e
   * nao zero: filtrar por custo zero devolveria um resultado que ninguem pediu.
   */
  it('ignora numero invalido em vez de virar zero', () => {
    const query = toCatalogQuery({ custoMin: 'abc', poderMax: '' })
    expect(query.costMin).toBeUndefined()
    expect(query.powerMax).toBeUndefined()
  })

  it('trata parametro repetido pelo primeiro valor', () => {
    expect(toCatalogQuery({ tipo: ['Character', 'Event'] }).type).toBe('Character')
  })

  it('descarta valor so de espacos', () => {
    expect(toCatalogQuery({ q: '   ' }).search).toBeUndefined()
  })

  it('aceita sobrescrita de quem chama, como o set da rota', () => {
    const query = toCatalogQuery({ q: 'nami' }, { setCode: 'OP01', pageSize: 60 })
    expect(query.setCode).toBe('OP01')
    expect(query.pageSize).toBe(60)
    expect(query.search).toBe('nami')
  })
})

describe('countActiveFilters', () => {
  it('conta filtros, e nao a busca nem a pagina', () => {
    expect(countActiveFilters({ q: 'luffy', pagina: '4' })).toBe(0)
    expect(countActiveFilters({ tipo: 'Character', cor: 'Red' })).toBe(2)
    expect(countActiveFilters({ custoMin: '2', custoMax: '5' })).toBe(2)
  })

  it('ignora parametro vazio', () => {
    expect(countActiveFilters({ tipo: '', cor: 'Red' })).toBe(1)
  })
})

describe('buildCatalogHref', () => {
  const base = () => new URLSearchParams('q=luffy&tipo=Character&pagina=4')

  it('preserva o que ja estava e sobrescreve o que mudou', () => {
    const href = buildCatalogHref('/catalogo', base(), { [PARAM.cor]: 'Red' })
    const params = new URLSearchParams(href.split('?')[1])

    expect(params.get('q')).toBe('luffy')
    expect(params.get('tipo')).toBe('Character')
    expect(params.get('cor')).toBe('Red')
  })

  /**
   * Refinar a busca na pagina 7 leva a uma pagina 7 que pode nao existir mais,
   * e a tela fica vazia sem explicacao. Mexer em filtro sempre volta ao inicio.
   */
  it('volta para a primeira pagina ao mudar um filtro', () => {
    const href = buildCatalogHref('/catalogo', base(), { [PARAM.cor]: 'Red' })
    expect(new URLSearchParams(href.split('?')[1]).get('pagina')).toBeNull()
  })

  it('mantem a pagina quando e ela que esta mudando', () => {
    const href = buildCatalogHref('/catalogo', base(), { [PARAM.pagina]: 5 }, { resetPage: false })
    expect(new URLSearchParams(href.split('?')[1]).get('pagina')).toBe('5')
  })

  it('remove o parametro quando o valor sai', () => {
    const href = buildCatalogHref('/catalogo', base(), { [PARAM.tipo]: undefined })
    expect(new URLSearchParams(href.split('?')[1]).get('tipo')).toBeNull()
  })

  it('devolve o caminho puro quando nao sobra nenhum parametro', () => {
    const href = buildCatalogHref('/catalogo', new URLSearchParams('tipo=Character'), {
      [PARAM.tipo]: undefined,
    })
    expect(href).toBe('/catalogo')
  })
})
