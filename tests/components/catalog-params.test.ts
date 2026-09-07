import { describe, expect, it } from 'vitest'
import {
  buildCatalogHref,
  countActiveFilters,
  PARAM,
  toCatalogQuery,
  cardHref,
  currentPath,
  safeReturnTo,
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

    // Facetas viram lista mesmo com um valor so: quem recebe nao precisa
    // distinguir "um" de "varios".
    expect(query).toMatchObject({
      search: 'luffy',
      type: ['Character'],
      color: ['Red'],
      rarity: ['SR'],
      variantType: ['Parallel'],
      attribute: ['Strike'],
      mechanic: ['Rush'],
      trait: ['Straw Hat Crew'],
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

  /**
   * Dentro de uma faceta os valores se somam por ou. Antes, o repetido perdia
   * todos menos o primeiro, e marcar Preto e Azul filtrava so por preto.
   */
  it('mantem todos os valores de um filtro repetido', () => {
    expect(toCatalogQuery({ tipo: ['Character', 'Event'] }).type).toEqual([
      'Character',
      'Event',
    ])
    expect(toCatalogQuery({ cor: ['Black', 'Blue'] }).color).toEqual(['Black', 'Blue'])
  })

  it('descarta os valores vazios de uma lista', () => {
    expect(toCatalogQuery({ cor: ['Black', '  ', ''] }).color).toEqual(['Black'])
    expect(toCatalogQuery({ cor: ['', ' '] }).color).toBeUndefined()
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

  /** Conta escolhas, e nao secoes: e o numero de coisas a desfazer. */
  it('conta cada valor de uma faceta multivalorada', () => {
    expect(countActiveFilters({ cor: ['Black', 'Blue'] })).toBe(2)
    expect(countActiveFilters({ cor: ['Black', 'Blue'], raridade: 'SR' })).toBe(3)
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

describe('volta para a lista de origem', () => {
  it('carrega o caminho de origem no link da carta', () => {
    expect(cardHref('7', '/catalogo?cor=Blue')).toBe(
      `/catalogo/carta/7?de=${encodeURIComponent('/catalogo?cor=Blue')}`,
    )
  })

  it('sem origem, o link fica limpo', () => {
    expect(cardHref('7')).toBe('/catalogo/carta/7')
  })

  it('monta o caminho atual com os filtros repetidos', () => {
    expect(currentPath('/catalogo', { cor: ['Black', 'Blue'], raridade: 'SR' })).toBe(
      '/catalogo?cor=Black&cor=Blue&raridade=SR',
    )
  })

  it('sem parametro nenhum, e so o caminho', () => {
    expect(currentPath('/catalogo', {})).toBe('/catalogo')
  })

  /**
   * So caminho relativo entra. Um valor absoluto — ou `//outro.site`, que o
   * navegador le como outro dominio — transformaria "voltar" num desvio para
   * fora do site.
   */
  it('recusa destino que sai do site', () => {
    expect(safeReturnTo('https://outro.test/phishing', '/catalogo')).toBe('/catalogo')
    expect(safeReturnTo('//outro.test/phishing', '/catalogo')).toBe('/catalogo')
    expect(safeReturnTo('javascript:alert(1)', '/catalogo')).toBe('/catalogo')
  })

  it('aceita caminho relativo com filtros', () => {
    expect(safeReturnTo('/catalogo?cor=Blue&cor=Black', '/catalogo')).toBe(
      '/catalogo?cor=Blue&cor=Black',
    )
  })

  it('sem valor, usa o padrao', () => {
    expect(safeReturnTo(undefined, '/catalogo')).toBe('/catalogo')
    expect(safeReturnTo('', '/catalogo')).toBe('/catalogo')
  })
})
