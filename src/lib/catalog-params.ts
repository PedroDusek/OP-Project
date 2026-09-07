import type { CatalogQuery } from '@/server/application/catalog/search-cards'

/**
 * A tradução entre a query string e os filtros do catálogo.
 *
 * Os filtros vivem na **URL**, e não em estado de componente. Três coisas
 * decorrem disso e nenhuma delas se recupera depois:
 *
 *   - a busca filtrada é compartilhável e volta igual pelo histórico;
 *   - a página é renderizada no servidor já filtrada, sem um segundo passo;
 *   - voltar do detalhe de uma carta devolve a lista onde ela estava.
 *
 * Os nomes dos parâmetros são em português, como as rotas e a documentação. A
 * conversão para o vocabulário interno acontece aqui, num lugar só.
 */

/** Nome do parâmetro na URL para cada filtro. */
export const PARAM = {
  busca: 'q',
  tipo: 'tipo',
  cor: 'cor',
  raridade: 'raridade',
  variante: 'variante',
  atributo: 'atributo',
  mecanica: 'mecanica',
  trait: 'trait',
  custoMin: 'custoMin',
  custoMax: 'custoMax',
  poderMin: 'poderMin',
  poderMax: 'poderMax',
  pagina: 'pagina',
} as const

export type CatalogSearchParams = Record<string, string | string[] | undefined>

const first = (value: string | string[] | undefined): string | undefined => {
  const single = Array.isArray(value) ? value[0] : value
  const trimmed = single?.trim()
  return trimmed ? trimmed : undefined
}

const number = (value: string | string[] | undefined): number | undefined => {
  const raw = first(value)
  if (raw === undefined) return undefined
  const parsed = Number(raw)
  // Texto no lugar de número vira "sem filtro", e não zero: uma URL editada à
  // mão não deve devolver um resultado que ninguém pediu.
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined
}

/** Converte a query string no que o caso de uso entende. */
export function toCatalogQuery(
  params: CatalogSearchParams,
  extra: Partial<CatalogQuery> = {},
): CatalogQuery {
  return {
    search: first(params[PARAM.busca]),
    type: first(params[PARAM.tipo]) as CatalogQuery['type'],
    color: first(params[PARAM.cor]),
    rarity: first(params[PARAM.raridade]),
    variantType: first(params[PARAM.variante]),
    attribute: first(params[PARAM.atributo]),
    mechanic: first(params[PARAM.mecanica]),
    trait: first(params[PARAM.trait]),
    costMin: number(params[PARAM.custoMin]),
    costMax: number(params[PARAM.custoMax]),
    powerMin: number(params[PARAM.poderMin]),
    powerMax: number(params[PARAM.poderMax]),
    page: number(params[PARAM.pagina]) ?? 1,
    ...extra,
  }
}

/** Quantos filtros estão ativos, sem contar a busca nem a paginação. */
export function countActiveFilters(params: CatalogSearchParams): number {
  const filterKeys = [
    PARAM.tipo,
    PARAM.cor,
    PARAM.raridade,
    PARAM.variante,
    PARAM.atributo,
    PARAM.mecanica,
    PARAM.trait,
    PARAM.custoMin,
    PARAM.custoMax,
    PARAM.poderMin,
    PARAM.poderMax,
  ]
  return filterKeys.filter((key) => first(params[key]) !== undefined).length
}

/**
 * Monta a query string preservando o que já estava lá.
 *
 * Mexer num filtro sempre volta para a página 1. Sem isso, refinar a busca na
 * página 7 leva a uma página 7 que pode não existir mais, e a tela fica vazia
 * sem explicação.
 */
export function buildCatalogHref(
  pathname: string,
  current: URLSearchParams,
  changes: Record<string, string | number | undefined>,
  { resetPage = true } = {},
): string {
  const next = new URLSearchParams(current)

  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === '') next.delete(key)
    else next.set(key, String(value))
  }

  if (resetPage && !(PARAM.pagina in changes)) next.delete(PARAM.pagina)

  const query = next.toString()
  return query ? `${pathname}?${query}` : pathname
}

/**
 * A mesma consulta, no vocabulário que `/api/catalog` aceita.
 *
 * A rolagem infinita pede as páginas seguintes pela API, e não por uma Server
 * Action, porque é a API que cobra a cota de leitura do catálogo — a cota que
 * sustenta na prática o compromisso da decisão 020 de nunca reexpô-lo.
 *
 * O schema da rota é `strict()`: chave desconhecida é 400. Por isso só entra o
 * que está definido, e `page` fica de fora — quem pagina acrescenta a sua.
 */
export function toApiQuery(query: CatalogQuery): string {
  const params = new URLSearchParams()

  const put = (key: string, value: string | number | undefined) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }

  put('search', query.search)
  put('setCode', query.setCode)
  put('type', query.type)
  put('color', query.color)
  put('rarity', query.rarity)
  put('variantType', query.variantType)
  put('attribute', query.attribute)
  put('mechanic', query.mechanic)
  put('trait', query.trait)
  put('costMin', query.costMin)
  put('costMax', query.costMax)
  put('powerMin', query.powerMin)
  put('powerMax', query.powerMax)
  put('pageSize', query.pageSize)

  return params.toString()
}
