import type { PrismaClient } from '@prisma/client'
import { buildCatalogWhere, type CatalogFilters } from '@/server/application/catalog/search-cards'
import { assertPremium } from '@/server/application/authorization'
import type { AuthenticatedUser } from '@/server/application/auth'
import {
  compareCatalogSort,
  DEFAULT_CATALOG_SORT,
  type CatalogSort,
} from '@/server/domain/catalog/order'
import {
  compareSetsByRelease,
  displaySetCode,
  displaySetName,
  setKind,
  type SetKind,
} from '@/server/domain/catalog/sets'
import { countsTowardPlayset, PLAYSET_SIZE } from '@/server/domain/collection/counting'
import { NORMAL_ART, readPlayset, type ArtCopies } from '@/server/domain/collection/playsets'

/**
 * Leitura de playsets (decisao 114).
 *
 * Camada: application.
 *
 * ## O universo mudou, e e a diferenca inteira
 *
 * Ate 23/11 playset era leitura da **colecao**: a consulta saia de
 * `collection_items`, e por isso a tela nunca podia mostrar `0/4` — ela so
 * sabia das cartas que a pessoa tinha. A pergunta era "das minhas cartas, quais
 * fecharam quatro".
 *
 * Agora a pergunta e "**de todas as cartas que existem**, quais eu fechei", que
 * e a de quem monta colecao. A consulta sai das `cards` e traz a colecao por
 * fora, e e por isso que isto e um caso de uso novo em vez de um parametro em
 * `searchCollection`: inverter o lado de onde a consulta parte nao e um filtro.
 *
 * ## Por que a tela pede uma colecao antes de listar
 *
 * O universo sao **2.816 cartas** (medido em 25/11: 2.325 Character, 438 Event,
 * 53 Stage; Leader e DON!! nunca contam). Sem recorte, "faltam" e uma lista de
 * milhares de linhas que nao responde nada — e por coleção sao no maximo
 * algumas centenas. A escolha do dono do produto, de pedir o set primeiro, e
 * tambem o que mantem a consulta barata.
 */

/** Os filtros que uma tela de playset aceita: so propriedades da **carta**. */
export type PlaysetFilters = Omit<CatalogFilters, 'rarity' | 'variantType'>

export interface PlaysetQuery extends PlaysetFilters {
  /** A mesma ordem do catalogo (decisao 110). Todas as sete sao da carta. */
  sort?: CatalogSort
}

export interface PlaysetCardRow {
  cardCode: string
  cardName: string
  cardType: string
  /**
   * A arte a exibir, preferindo a **Normal**.
   *
   * Numa linha `0/4` a pessoa esta decidindo o que comprar, e a Normal e a que
   * ela vai encontrar. Mostrar a paralela de uma carta que ela nao tem sugeriria
   * uma compra que nao e a que fecha o playset mais barato.
   */
  imageUrl: string | null
  quantity: number
  closed: boolean
  /** Copias contadas que sao de arte paralela. Ver `domain/collection/playsets`. */
  otherArtCopies: number
}

/**
 * As colecoes e o total, que **nao** e a soma delas.
 *
 * Uma carta reimpressa pertence a dois sets e conta nos dois: somar os `total`
 * de cada colecao daria mais que o catalogo tem. Por isso o total vem contado
 * sobre cartas **distintas**, aqui, em vez de a tela somar a lista.
 */
export interface PlaysetOverview {
  sets: PlaysetSetSummary[]
  /** Cartas distintas que contam playset. Medido em 25/11: 2.816. */
  total: number
  closed: number
}

export interface PlaysetSetSummary {
  code: string
  displayCode: string
  displayName: string
  kind: SetKind
  /** Cartas do set que contam playset. E o denominador. */
  total: number
  closed: number
}

/**
 * Tira os filtros de **variante**.
 *
 * Raridade e tipo de arte sao propriedades da variante, e playset conta a carta
 * somando todas as artes: filtrando "arte paralela", um `2/4` poderia ser duas
 * copias Normal, e a linha mentiria. Escolha do dono do produto em 25/11 — a
 * tela oferece set, cor, tipo, custo, poder e atributo, que sao da carta.
 *
 * A limpeza fica aqui, e nao so na tela, pelo mesmo motivo que o Premium e
 * recusado no caso de uso: esconder o filtro e continuar respondendo a ele seria
 * trava de fachada para quem monta o endereco a mao.
 */
function semFiltroDeArte(filters: CatalogFilters): CatalogFilters {
  const { rarity, variantType, ...resto } = filters
  void rarity
  void variantType
  return resto
}

async function collectionIdOf(
  prisma: PrismaClient,
  user: AuthenticatedUser,
): Promise<bigint | null> {
  const collection = await prisma.collection.findUnique({
    where: { userId: user.id },
    select: { id: true },
  })
  return collection?.id ?? null
}

/**
 * Copias por carta, somando todas as artes, da colecao inteira.
 *
 * Nao filtra por set de proposito: a regra 2.1 soma **todas** as artes da
 * carta, e uma arte paralela impressa so em OP-09 conta no playset de uma carta
 * reimpressa em OP-18. Escopar por set aqui daria um numero menor que o da
 * regra, e seria dificil de notar.
 */
async function copiasPorCarta(
  prisma: PrismaClient,
  collectionId: bigint | null,
): Promise<Map<string, number>> {
  if (!collectionId) return new Map()

  const items = await prisma.collectionItem.findMany({
    where: { collectionId, quantity: { gt: 0 } },
    select: { quantity: true, cardVariant: { select: { cardId: true } } },
  })

  const total = new Map<string, number>()
  for (const item of items) {
    const key = String(item.cardVariant.cardId)
    total.set(key, (total.get(key) ?? 0) + item.quantity)
  }
  return total
}

/**
 * As colecoes, com quantos playsets cada uma tem fechados.
 *
 * Uma consulta traz os ~4.900 pares (carta, set) de `variant_printings` e a
 * agregacao acontece aqui, pelo mesmo motivo de `list-sets.ts`: a ordem de
 * lancamento vive no dominio e a regra de playset e binaria por carta — as duas
 * sao mais faceis de escrever certo aqui que em SQL, e ficam num lugar so.
 *
 * **A colecao dos DON!! nao aparece, e nao ha caso especial para isso.** Toda
 * carta dela e do tipo `DON`, que nunca conta playset (decisao 112), entao o
 * set termina sem nenhuma carta no universo e nao entra na lista. A regra
 * resolve, e um `if` com o codigo do set escrito a mao envelheceria.
 */
export async function listPlaysetSets(
  prisma: PrismaClient,
  user: AuthenticatedUser,
): Promise<PlaysetOverview> {
  assertPremium(user, 'Os playsets sao um recurso Premium.')

  const collectionId = await collectionIdOf(prisma, user)

  const [printings, copias] = await Promise.all([
    prisma.variantPrinting.findMany({
      select: {
        set: { select: { code: true, name: true } },
        cardVariant: { select: { cardId: true, card: { select: { type: true } } } },
      },
    }),
    copiasPorCarta(prisma, collectionId),
  ])

  const porSet = new Map<string, { name: string; cards: Set<string> }>()
  /* Cartas distintas, para o total nao somar duas vezes a reimpressa. */
  const todas = new Set<string>()

  for (const printing of printings) {
    if (!countsTowardPlayset(printing.cardVariant.card.type)) continue

    const cardId = String(printing.cardVariant.cardId)
    todas.add(cardId)

    const existente = porSet.get(printing.set.code)
    const entrada = existente ?? { name: printing.set.name, cards: new Set<string>() }
    entrada.cards.add(cardId)
    if (!existente) porSet.set(printing.set.code, entrada)
  }

  const fechou = (cardId: string) => (copias.get(cardId) ?? 0) >= PLAYSET_SIZE

  let closed = 0
  for (const cardId of todas) {
    if (fechou(cardId)) closed += 1
  }

  const sets = [...porSet.entries()]
    .map(([code, entrada]) => {
      let fechados = 0
      for (const cardId of entrada.cards) {
        if (fechou(cardId)) fechados += 1
      }

      return {
        code,
        displayCode: displaySetCode(code),
        displayName: displaySetName(entrada.name),
        kind: setKind(code),
        total: entrada.cards.size,
        closed: fechados,
      }
    })
    .sort((a, b) => compareSetsByRelease(a.code, b.code))

  return { sets, total: todas.size, closed }
}

/**
 * Os playsets de uma colecao, inclusive os que estao em `0/4`.
 *
 * ## Duas consultas, e a segunda **nao** e escopada pelo set
 *
 * O filtro do catalogo opera sobre variantes, e aqui ele serve so para escolher
 * **quais cartas** aparecem. Depois disso, as copias vem de todas as artes da
 * carta, impressas onde for: `OP14-EB04` existe porque uma variante e impressa
 * em mais de um set, e uma arte paralela de OP-09 conta no playset de uma carta
 * reimpressa em OP-18 (regra 2.1). Somar so o que esta impresso no set pedido
 * daria um numero menor que a regra, e a tela nao teria como avisar.
 */
export async function searchPlaysets(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  setCode: string,
  query: PlaysetQuery = {},
): Promise<PlaysetCardRow[]> {
  assertPremium(user, 'Os playsets sao um recurso Premium.')

  const collectionId = await collectionIdOf(prisma, user)

  const noRecorte = await prisma.cardVariant.findMany({
    where: buildCatalogWhere({ ...semFiltroDeArte(query), setCode }),
    select: { cardId: true },
  })

  const cardIds = [...new Set(noRecorte.map((variante) => variante.cardId))]
  if (cardIds.length === 0) return []

  const [cards, items] = await Promise.all([
    prisma.card.findMany({
      where: { id: { in: cardIds } },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        cost: true,
        power: true,
        variants: { select: { variantType: true, imageUrl: true } },
      },
    }),
    collectionId
      ? prisma.collectionItem.findMany({
          where: {
            collectionId,
            quantity: { gt: 0 },
            cardVariant: { cardId: { in: cardIds } },
          },
          select: {
            quantity: true,
            cardVariant: { select: { cardId: true, variantType: true } },
          },
        })
      : [],
  ])

  const possuido = new Map<string, ArtCopies[]>()
  for (const item of items) {
    const key = String(item.cardVariant.cardId)
    const lista = possuido.get(key)
    const copia: ArtCopies = {
      variantType: item.cardVariant.variantType,
      quantity: item.quantity,
    }
    if (lista) lista.push(copia)
    else possuido.set(key, [copia])
  }

  const rows = cards
    // `Leader` e `DON` nao contam playset e nao tem o que mostrar numa tela de
    // playset. O filtro do catalogo nao sabe disso: a regra e nossa.
    .filter((card) => countsTowardPlayset(card.type))
    .map((card) => {
      const leitura = readPlayset(card.type, possuido.get(String(card.id)) ?? [])
      const normal = card.variants.find(
        (variante) => variante.variantType === NORMAL_ART && variante.imageUrl !== null,
      )
      const qualquer = card.variants.find((variante) => variante.imageUrl !== null)

      return {
        cardCode: card.code,
        cardName: card.name,
        cardType: card.type,
        imageUrl: (normal ?? qualquer)?.imageUrl ?? null,
        quantity: leitura.quantity,
        closed: leitura.closed,
        otherArtCopies: leitura.otherArtCopies,
        cost: card.cost,
        power: card.power,
      }
    })

  /*
   * A ordem escolhida primeiro, o codigo como desempate. As sete ordens do
   * catalogo sao todas da carta (codigo, nome, custo, poder), entao valem aqui
   * sem traducao — e a pessoa nao encontra uma tela que ordena diferente das
   * outras.
   *
   * Nao ha o desempate por `compareCatalogOrder` que a colecao usa: ele ordena
   * **variantes** dentro de um set, e aqui a linha e a carta.
   */
  const sort = query.sort ?? DEFAULT_CATALOG_SORT
  rows.sort(
    (a, b) =>
      compareCatalogSort({ cardName: a.cardName, cost: a.cost, power: a.power }, { cardName: b.cardName, cost: b.cost, power: b.power }, sort) ||
      a.cardCode.localeCompare(b.cardCode),
  )

  // `cost` e `power` existem so para ordenar; a tela nao os recebe.
  return rows.map(({ cost, power, ...resto }) => {
    void cost
    void power
    return resto
  })
}
