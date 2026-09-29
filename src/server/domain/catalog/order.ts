import { compareSetsForCatalog } from './sets'

/**
 * A ordem em que as cartas aparecem em toda listagem.
 *
 * Camada: domain. Puro, sem I/O.
 *
 * ## A regra (decisão 040, alterada pela 069)
 *
 * Set na ordem do catálogo, depois código da carta, depois o número da arte —
 * a normal antes, e `_p1`, `_p2`, `_p10` em ordem numérica —, e o id só como
 * último desempate.
 *
 * O objetivo é o que o dono do produto pediu: dentro de qualquer filtro, as
 * cartas em ordem de código, para quem confere uma coleção não precisar voltar
 * atrás procurando a que ficou para trás.
 *
 * ## Em que set uma arte fica
 *
 * A 040 partia de "cada variante tem uma impressão". A 052 desfez isso ao tornar
 * reimpressão uma impressão, e 372 variantes passaram a ter duas ou três. A
 * listagem pegava a primeira que o banco devolvia, sem ordem definida — e a
 * `OP01-073` normal, impressa também no ST-17, caía no fim da OP01.
 *
 * O set que posiciona a arte é, nesta ordem:
 *
 *   1. **o set filtrado**, quando a tela filtra por um e a arte foi impressa
 *      nele — dentro da OP01, tudo é OP01, e a ordem vira a do código;
 *   2. **o set do próprio código**, quando a arte foi impressa nele — a
 *      `OP01-073` fica na OP01 mesmo sem filtro;
 *   3. **o primeiro na ordem do catálogo**, para a arte que só existe em outro
 *      produto — a `OP01-016_p4`, impressa só na OP05, fica na OP05.
 *
 * O item 2 não é "a impressão mais antiga": a ordem do catálogo põe coleções
 * antes de starter decks, e a `ST01-014`, reimpressa na PRB-01, pularia do ST-01
 * para o meio das coleções. Medido: seriam 65 variantes fora de casa.
 */

export interface CatalogOrderKey {
  cardCode: string
  /** O `source_id` da Bandai: `OP01-016` para a normal, `OP01-016_p3` para a arte. */
  sourceId: string | null
  /** O set que posiciona a arte — ver `placementSet`. */
  setCode: string | null
}

/** Letras e número de cada código de set: `OP14-EB04` → `OP14`, `EB04`. */
function setTokens(code: string): string[] {
  return (code.toUpperCase().replace(/[^A-Z0-9]/g, '').match(/[A-Z]+\d+/g) ?? []).map(canonical)
}

/** `OP01` e `OP1` são o mesmo: o número vale pelo valor, e não pelos zeros. */
function canonical(token: string): string {
  const match = /^([A-Z]+)(\d+)$/.exec(token)
  return match ? `${match[1]}${Number(match[2])}` : token
}

/** O set que o código da carta nomeia: `OP01-016` → `OP1`. `P-001` não nomeia nenhum. */
function cardSetToken(cardCode: string): string | null {
  const match = /^([A-Za-z]+)(\d+)-/.exec(cardCode.trim())
  return match ? canonical(`${match[1].toUpperCase()}${match[2]}`) : null
}

/**
 * Se o set é o que o código da carta nomeia: `OP01-073` e `OP01` sim, e `ST-17`
 * não. Serve à ordem e à conferência da Liga, que precisam da mesma leitura.
 */
export function isOwnSet(cardCode: string, setCode: string): boolean {
  const proprio = cardSetToken(cardCode)
  return proprio !== null && setTokens(setCode).includes(proprio)
}

export function placementSet(
  cardCode: string,
  setCodes: readonly string[],
  filteredSet?: string | null,
): string | null {
  if (setCodes.length === 0) return null

  if (filteredSet) {
    const alvo = filteredSet.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const filtrado = setCodes.find((code) => code.toUpperCase().replace(/[^A-Z0-9]/g, '') === alvo)
    if (filtrado) return filtrado
  }

  const doCodigo = setCodes.find((code) => isOwnSet(cardCode, code))
  if (doCodigo) return doCodigo

  return [...setCodes].sort(compareSetsForCatalog)[0]
}

/** O número da arte: `0` para a normal, `3` para `_p3`. */
export function artNumber(sourceId: string | null): number {
  const match = /_p(\d+)$/i.exec(sourceId ?? '')
  return match ? Number(match[1]) : 0
}

/**
 * Compara duas artes pela ordem de listagem. Devolve `0` só quando set, carta e
 * número da arte empatam — quem chama desempata pelo id, que é o que mantém a
 * rolagem estável entre uma leva e a seguinte.
 */
export function compareCatalogOrder(a: CatalogOrderKey, b: CatalogOrderKey): number {
  const set = compareSetsForCatalog(a.setCode, b.setCode)
  if (set !== 0) return set
  if (a.cardCode !== b.cardCode) return a.cardCode < b.cardCode ? -1 : 1
  return artNumber(a.sourceId) - artNumber(b.sourceId)
}

/**
 * As ordens que a pessoa pode escolher (decisão 110).
 *
 * `codigo` é o padrão e é a ordem descrita acima — a das decisões 040 e 069.
 * As outras **não a substituem**: elas mandam no primeiro critério, e o empate
 * volta para ela. Isso não é zelo. Ordenando por custo, algumas centenas de
 * cartas empatam em 3, e sem um segundo critério estável elas trocariam de
 * lugar entre uma página e a seguinte — a mesma carta apareceria duas vezes ou
 * nenhuma, que foi o que o desempate por id já evitava.
 */
export const CATALOG_SORTS = [
  'codigo',
  'nome',
  'nome-desc',
  'custo',
  'custo-desc',
  'poder',
  'poder-desc',
] as const

export type CatalogSort = (typeof CATALOG_SORTS)[number]

export const CATALOG_SORT_LABELS: Record<CatalogSort, string> = {
  codigo: 'Código do set',
  nome: 'Nome (A → Z)',
  'nome-desc': 'Nome (Z → A)',
  custo: 'Custo (menor primeiro)',
  'custo-desc': 'Custo (maior primeiro)',
  poder: 'Poder (menor primeiro)',
  'poder-desc': 'Poder (maior primeiro)',
}

export const DEFAULT_CATALOG_SORT: CatalogSort = 'codigo'

/** O que ordenar precisa saber de uma arte, além da chave de catálogo. */
export interface CatalogSortKey {
  cardName: string
  cost: number | null
  power: number | null
}

/** Valor vindo da URL. O que não for uma ordem conhecida vira o padrão. */
export function parseCatalogSort(raw: string | null | undefined): CatalogSort {
  const value = raw?.trim().toLowerCase()
  return CATALOG_SORTS.find((sort) => sort === value) ?? DEFAULT_CATALOG_SORT
}

/**
 * Compara duas artes pelo critério escolhido. `0` quer dizer empate, e quem
 * chama desempata com `compareCatalogOrder` e depois o id.
 *
 * ## Nulo vai para o fim, nas duas direções
 *
 * `null` num campo numérico quer dizer **"este tipo de carta não tem este
 * campo"**, e não zero (armadilha 87): Leader não tem custo, Event não tem
 * poder. Um não-valor não pode competir por posição, então ele não sobe no
 * crescente nem no decrescente — sai do caminho de quem ordena e fica no fim
 * das duas vezes.
 *
 * Zero é diferente e ordena normalmente: `OP01-006 Otama` tem poder 0 mesmo, e
 * em "poder, menor primeiro" ela é a primeira da lista.
 */
export function compareCatalogSort(a: CatalogSortKey, b: CatalogSortKey, sort: CatalogSort): number {
  switch (sort) {
    case 'codigo':
      return 0
    case 'nome':
      return compareNames(a.cardName, b.cardName)
    case 'nome-desc':
      return compareNames(b.cardName, a.cardName)
    case 'custo':
      return compareNumbers(a.cost, b.cost, false)
    case 'custo-desc':
      return compareNumbers(a.cost, b.cost, true)
    case 'poder':
      return compareNumbers(a.power, b.power, false)
    case 'poder-desc':
      return compareNumbers(a.power, b.power, true)
  }
}

/**
 * `localeCompare` e não `<`: os nomes da Bandai misturam maiúscula e
 * pontuação, e por ordem de byte `"Zoro"` viria antes de `"absolute"`.
 */
function compareNames(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true })
}

/** Ver o bloco sobre nulo em `compareCatalogSort`. */
function compareNumbers(a: number | null, b: number | null, descending: boolean): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return descending ? b - a : a - b
}
