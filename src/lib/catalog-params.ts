import type { CatalogQuery } from '@/server/application/catalog/search-cards'
import { parseCounterValue, type CounterValue } from '@/server/domain/catalog/counter'

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
  set: 'set',
  tipo: 'tipo',
  cor: 'cor',
  raridade: 'raridade',
  variante: 'variante',
  atributo: 'atributo',
  mecanica: 'mecanica',
  trait: 'trait',
  contador: 'contador',
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

/**
 * Todos os valores de um filtro que aceita mais de um.
 *
 * Dentro de uma faceta os valores se somam por **ou**: marcar Preto e Azul pede
 * "preta ou azul". Entre facetas vale o **e**.
 *
 * `undefined` quando nao ha nada, e nunca lista vazia: quem recebe nao deveria
 * ter de distinguir "sem filtro" de "filtro que nao casa com nada".
 */
const list = (value: string | string[] | undefined): string[] | undefined => {
  const values = (Array.isArray(value) ? value : [value])
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item))
  return values.length > 0 ? values : undefined
}

const number = (value: string | string[] | undefined): number | undefined => {
  const raw = first(value)
  if (raw === undefined) return undefined
  const parsed = Number(raw)
  // Texto no lugar de número vira "sem filtro", e não zero: uma URL editada à
  // mão não deve devolver um resultado que ninguém pediu.
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined
}

/**
 * Os valores de counter da URL, descartando o que não é um dos três.
 *
 * `undefined` quando não sobra nenhum: `?contador=500` é "sem filtro", e não
 * "personagens sem counter".
 */
const counters = (value: string | string[] | undefined): CounterValue[] | undefined => {
  const valid = (list(value) ?? [])
    .map(parseCounterValue)
    .filter((item): item is CounterValue => item !== undefined)
  return valid.length > 0 ? valid : undefined
}

/** Converte a query string no que o caso de uso entende. */
export function toCatalogQuery(
  params: CatalogSearchParams,
  extra: Partial<CatalogQuery> = {},
): CatalogQuery {
  return {
    search: first(params[PARAM.busca]),
    // Um set so: "as cartas de OP-09" e a pergunta; "as de OP-09 ou OP-11" nao
    // e um gesto que alguem faca montando colecao.
    setCode: first(params[PARAM.set]),
    type: list(params[PARAM.tipo]) as CatalogQuery['type'],
    color: list(params[PARAM.cor]),
    rarity: list(params[PARAM.raridade]),
    variantType: list(params[PARAM.variante]),
    attribute: list(params[PARAM.atributo]),
    mechanic: list(params[PARAM.mecanica]),
    trait: list(params[PARAM.trait]),
    counter: counters(params[PARAM.contador]),
    costMin: number(params[PARAM.custoMin]),
    costMax: number(params[PARAM.custoMax]),
    powerMin: number(params[PARAM.poderMin]),
    powerMax: number(params[PARAM.poderMax]),
    page: number(params[PARAM.pagina]) ?? 1,
    ...extra,
  }
}

/**
 * Quantos filtros estão ativos, sem contar a busca nem a paginação.
 *
 * Conta **valores**, e não facetas: com Preto e Azul marcados o distintivo diz
 * 2, que é o número de escolhas que a pessoa fez e o número de coisas que ela
 * precisa desfazer para voltar ao catálogo inteiro.
 */
export function countActiveFilters(params: CatalogSearchParams): number {
  const multiKeys = [
    PARAM.tipo,
    PARAM.cor,
    PARAM.raridade,
    PARAM.variante,
    PARAM.atributo,
    PARAM.mecanica,
    PARAM.trait,
    PARAM.contador,
  ]
  const singleKeys = [PARAM.set, PARAM.custoMin, PARAM.custoMax, PARAM.poderMin, PARAM.poderMax]

  const many = multiKeys.reduce((total, key) => total + (list(params[key])?.length ?? 0), 0)
  const single = singleKeys.filter((key) => first(params[key]) !== undefined).length
  return many + single
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
  changes: Record<string, string | number | string[] | undefined>,
  { resetPage = true } = {},
): string {
  const next = new URLSearchParams(current)

  for (const [key, value] of Object.entries(changes)) {
    // Lista sempre substitui a anterior inteira: apagar antes de acrescentar é
    // o que impede um valor desmarcado sobreviver na URL.
    next.delete(key)

    if (value === undefined || value === '') continue
    if (Array.isArray(value)) {
      for (const item of value) if (item !== '') next.append(key, item)
    } else {
      next.set(key, String(value))
    }
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

  const put = (key: string, value: string | number | readonly string[] | undefined) => {
    if (value === undefined || value === '') return
    // Multivalorado vira parâmetro repetido, que é o que o schema da rota
    // aceita — e o que o navegador manda naturalmente.
    if (Array.isArray(value)) for (const item of value) params.append(key, item)
    else params.set(key, String(value as string | number))
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
  put(
    'counter',
    query.counter === undefined
      ? undefined
      : ([] as CounterValue[]).concat(query.counter).map(String),
  )
  put('costMin', query.costMin)
  put('costMax', query.costMax)
  put('powerMin', query.powerMin)
  put('powerMax', query.powerMax)
  put('pageSize', query.pageSize)

  return params.toString()
}

/**
 * Para onde o detalhe de uma carta volta.
 *
 * A lista filtrada vive na URL, mas o detalhe é outra rota: sem carregar a
 * origem, "voltar ao catálogo" devolvia o catálogo **inteiro**, e quem tinha
 * filtrado por azul para registrar cinco cartas azuis refazia o filtro cinco
 * vezes.
 *
 * O caminho de origem viaja num parâmetro só, codificado. É o mesmo arranjo do
 * `next` da tela de entrar — e tem o mesmo cuidado: só caminho relativo entra.
 */
export const RETURN_PARAM = 'de'

export function cardHref(variantId: string, origin?: string): string {
  const base = `/catalogo/carta/${variantId}`
  if (!origin) return base
  return `${base}?${RETURN_PARAM}=${encodeURIComponent(origin)}`
}

/**
 * O caminho de volta, ou o padrão.
 *
 * Recusa qualquer coisa que não comece com uma barra, e também `//`, que o
 * navegador lê como outro domínio. Sem isso, um link montado por terceiro
 * transformaria o botão "voltar" num desvio para fora do site.
 */
export function safeReturnTo(
  value: string | string[] | undefined,
  fallback: string,
): string {
  const raw = first(value)
  if (!raw) return fallback
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback
  return raw
}

/** O caminho atual com a query, do jeito que `cardHref` espera receber. */
export function currentPath(pathname: string, params: CatalogSearchParams): string {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    if (Array.isArray(value)) for (const item of value) query.append(key, item)
    else query.set(key, value)
  }

  const search = query.toString()
  return search ? `${pathname}?${search}` : pathname
}
