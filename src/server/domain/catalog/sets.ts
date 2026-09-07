/**
 * Ordenacao, classificacao e exibicao de sets.
 *
 * Camada: domain. Puro, sem I/O.
 *
 * Existe porque os codigos que a fonte usa **nao sao uniformes**. No catalogo
 * importado convivem `OP01` e `OP-07`, `ST13` e `ST-01`, alem de `OP14-EB04`,
 * `PRB-01`, `GC-01` e `PROMO`. Ordenar por texto puro coloca `OP-07` antes de
 * `OP01`, o que embaralha a unica sequencia que a pessoa reconhece.
 */

/** Codigo sem pontuacao e em maiusculas, para comparar `OP-01` com `OP01`. */
export function normalizeSetCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * Chave de ordenacao natural: prefixo de letras, primeiro numero, e o codigo
 * normalizado como desempate.
 *
 * `OP14-EB04` cai em (`OP`, 14). `PROMO`, que nao tem numero, vai para o fim do
 * proprio prefixo.
 *
 * E a ordem de reserva: vale para o que a ordem de lancamento nao cobre.
 */
export function setSortKey(code: string): [string, number, string] {
  const normalized = normalizeSetCode(code)
  const match = /^([A-Z]+)(\d+)?/.exec(normalized)
  const prefix = match?.[1] ?? normalized
  const number = match?.[2] ? Number(match[2]) : Number.POSITIVE_INFINITY
  return [prefix, number, normalized]
}

export function compareSetCodes(a: string, b: string): number {
  const [prefixA, numberA, rawA] = setSortKey(a)
  const [prefixB, numberB, rawB] = setSortKey(b)

  if (prefixA !== prefixB) return prefixA < prefixB ? -1 : 1
  if (numberA !== numberB) return numberA - numberB
  return rawA < rawB ? -1 : rawA > rawB ? 1 : 0
}

// ------------------------------------------------------------ classificacao

/**
 * O que um set e.
 *
 * `collection` cobre booster, extra booster e premium booster: coisas que se
 * abrem para colecionar. `deck` cobre os produtos prontos para jogar. `promo`
 * e o que nao e vendido como produto proprio.
 */
export type SetKind = 'collection' | 'deck' | 'promo'

/**
 * O rotulo de `deck` diz **Starter Decks**, e nao "Decks", a pedido do dono do
 * produto: o produto tera decks *do usuario* em Armazenamento, e duas coisas
 * chamadas "deck" na mesma interface confundiriam sem necessidade.
 *
 * A fonte rotula estes produtos como `STARTER DECK`, `STARTER DECK EX` e
 * `ULTRA DECK`. "Starter Decks" cobre a maioria e distingue do que importa
 * distinguir; a precisao dos tres nomes nao vale a ambiguidade que ela evita.
 */
export const SET_KIND_LABEL: Record<SetKind, string> = {
  collection: 'Coleções',
  deck: 'Starter Decks',
  promo: 'Promocionais',
}

/**
 * Classifica pelo prefixo do codigo.
 *
 * Isto **nao** e inferencia de padrao no estilo que a decisao 022 recusou: a
 * propria fonte rotula cada serie no seletor da pagina de listagem, e a
 * correspondencia foi conferida uma a uma no snapshot:
 *
 *   ST-01 a ST-36   STARTER DECK, STARTER DECK EX, ULTRA DECK
 *   OP-01 a OP-17   BOOSTER PACK
 *   EB-01 a EB-03   EXTRA BOOSTER
 *   PRB-01, PRB-02  PREMIUM BOOSTER
 *   PROMO           Promotion card
 *   GC-01           Other Product Card
 *
 * Nenhum `ST` e booster e nenhum booster e `ST`. O prefixo e um espelho fiel do
 * rotulo, e usa-lo evita uma coluna nova e uma reimportacao.
 *
 * O que se perde: se a fonte um dia lancar um `ST` que nao seja deck, isto
 * erra em silencio. Guardar o rotulo da serie em `sets` resolveria de vez, e
 * esta registrado como pendencia no handoff.
 */
export function setKind(code: string): SetKind {
  const normalized = normalizeSetCode(code)
  if (normalized.startsWith('ST')) return 'deck'
  if (normalized.startsWith('PROMO')) return 'promo'
  return 'collection'
}

// --------------------------------------------------------- ordem de lancamento

/**
 * A ordem em que as colecoes sairam, informada pelo dono do produto.
 *
 * Nao da para derivar isto do que temos: `sets` guarda codigo e nome, e ordenar
 * codigos nao e ordenar por data — os extra boosters saem **entre** os boosters,
 * e nenhuma ordenacao de texto ou numero produz esse intercalamento.
 *
 * Os codigos aqui sao os que existem no catalogo importado, e nao os da lista
 * original: o que la e `OP-14` chegou como `OP14-EB04`, porque o lancamento
 * internacional juntou o EB-04 aos boosters 14 e 15. Por isso `EB-04` nao
 * aparece nesta lista — nao existe como set separado no nosso catalogo.
 *
 * Set que nao estiver aqui — decks, promocionais, e qualquer coletanea futura —
 * cai na ordenacao natural do codigo, depois dos que estao.
 */
const RELEASE_ORDER = [
  'OP01',
  'OP02',
  'OP03',
  'OP04',
  'OP05',
  'OP06',
  'EB01',
  'OP07',
  'OP08',
  'OP09',
  'OP10',
  'EB02',
  'OP11',
  'OP12',
  'OP13',
  'OP14EB04',
  'EB03',
  'OP15EB04',
  'OP16',
  'OP17',
]

const RELEASE_POSITION = new Map(RELEASE_ORDER.map((code, index) => [code, index]))

/** Posicao na ordem de lancamento, ou `null` quando ela nao a cobre. */
export function releasePosition(code: string): number | null {
  return RELEASE_POSITION.get(normalizeSetCode(code)) ?? null
}

/**
 * Ordena por lancamento, do mais antigo para o mais novo.
 *
 * O que a ordem conhecida nao cobre vai para o fim, entre si na ordem natural
 * do codigo. Assim uma coletanea nova aparece na lista no dia em que for
 * importada, em vez de sumir por nao ter sido prevista — e o lugar dela e o
 * fim, que e onde uma coletanea nova costuma pertencer.
 */
export function compareSetsByRelease(a: string, b: string): number {
  const positionA = releasePosition(a)
  const positionB = releasePosition(b)

  if (positionA !== null && positionB !== null) return positionA - positionB
  if (positionA !== null) return -1
  if (positionB !== null) return 1
  return compareSetCodes(a, b)
}

// -------------------------------------------------------------- exibicao

/**
 * Nome do set para exibicao.
 *
 * A fonte envolve varios nomes em hifens decorativos: `-ROMANCE DAWN-`. Tirar
 * os dois deixa `ROMANCE DAWN`, que e o nome.
 *
 * A regra e simetrica de proposito: so remove quando **comeca e termina** com
 * hifen. `BOOSTER PACK -THE WORLD'S STRONGEST WARRIORS-` fica intacto, porque
 * remover so o hifen final deixaria um nome pela metade — pior que o original.
 *
 * Isto e apresentacao, e nao correcao de dado: o valor guardado continua sendo
 * o que a fonte publicou.
 */
export function displaySetName(name: string): string {
  const withoutType = stripSeriesType(name.trim())
  if (withoutType.length > 2 && withoutType.startsWith('-') && withoutType.endsWith('-')) {
    return withoutType.slice(1, -1).trim()
  }
  return withoutType
}

/**
 * Os rotulos de tipo de serie que a fonte usa.
 *
 * A importacao os pegou de forma **inconsistente**: `OP-17` chegou como
 * `BOOSTER PACK -THE WORLD'S STRONGEST WARRIORS-` e `OP-01` como
 * `-ROMANCE DAWN-`, embora os dois sejam booster pack. Numa lista, uns poucos
 * nomes com o prefixo e o resto sem parece defeito — e e.
 *
 * O tipo ja aparece na tela pela secao em que o set esta, entao repeti-lo no
 * nome nao acrescenta nada.
 *
 * Os mais longos vem primeiro: sem isso, `STARTER DECK` casaria dentro de
 * `STARTER DECK EX` e deixaria um `EX` solto no nome.
 */
const SERIES_TYPES = [
  'STARTER DECK EX',
  'STARTER DECK',
  'ULTRA DECK',
  'BOOSTER PACK',
  'EXTRA BOOSTER',
  'PREMIUM BOOSTER',
]

function stripSeriesType(name: string): string {
  const upper = name.toUpperCase()
  for (const type of SERIES_TYPES) {
    if (upper.startsWith(type)) return name.slice(type.length).trim()
  }
  return name
}

/**
 * Quantas cartas o set tem, para exibir.
 *
 * Diz "cartas" e conta **variantes impressas**. A escolha e do dono do produto:
 * "154 variantes" faz quem esta montando colecao parar para pensar, e "154
 * cartas" e como as pessoas falam do tamanho de um set.
 *
 * A distincao entre carta e variante continua valendo em todo o resto do
 * sistema — contagem, playset e progresso seguem `business-rules.md` 2. O que
 * muda aqui e a palavra na tela, e so isso.
 */
export function cardCountLabel(count: number): string {
  return count === 1 ? '1 carta' : `${count.toLocaleString('pt-BR')} cartas`
}

/**
 * Ordem em que os sets aparecem numa listagem de **cartas** sem filtro.
 *
 * Tres grupos, nesta ordem:
 *
 *   1. colecoes, na ordem de lancamento informada;
 *   2. starter decks, por numero — que e a ordem de lancamento deles, conferida
 *      contra os identificadores de serie da fonte, atribuidos em sequencia;
 *   3. promocionais.
 *
 * As promos vao para o fim porque e o que o dono do produto pediu, e porque elas
 * sao versoes alternativas de cartas que ja apareceram antes: encontra-las
 * espalhadas no meio da lista faz a mesma carta reaparecer sem explicacao.
 *
 * ## O que esta ordem **nao** faz
 *
 * Nao intercala starter decks com colecoes por data. Saber que o ST-05 saiu
 * entre o OP-02 e o OP-03 exigiria a data de cada um, que o modelo nao guarda e
 * que nao foi informada. Ordenar por numero dentro de cada grupo e o mais longe
 * que o dado alcanca sem inventar.
 *
 * Set sem printing — existe um no catalogo — vai para o fim de tudo.
 */
const KIND_RANK: Record<SetKind, number> = { collection: 0, deck: 1, promo: 2 }

export function compareSetsForCatalog(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1

  const kindDelta = KIND_RANK[setKind(a)] - KIND_RANK[setKind(b)]
  if (kindDelta !== 0) return kindDelta

  return compareSetsByRelease(a, b)
}
