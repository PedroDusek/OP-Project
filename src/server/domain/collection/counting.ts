/**
 * A aritmetica da colecao.
 *
 * Camada: domain. Pura, sincrona, sem I/O — e por isso os cenarios obrigatorios
 * da secao 7 de `business-rules.md` sao testados aqui, sem banco.
 *
 * Tres numeros que parecem o mesmo e nao sao:
 *
 *   total de cartas   soma das copias fisicas
 *   cartas unicas     variantes distintas possuidas
 *   playsets fechados ver abaixo, e o mais facil de errar
 */

/** Copias de uma mesma carta que fecham um playset. */
export const PLAYSET_SIZE = 4

/**
 * Tipos que nunca contam playset.
 *
 * `Leader` porque um deck usa exatamente um. `DON!!` esta fora do catalogo e
 * por isso nao aparece aqui — se um dia entrar, entra nesta lista.
 */
const TYPES_WITHOUT_PLAYSET = new Set(['Leader'])

export interface OwnedVariant {
  /** Agrupa o playset. Duas artes da mesma carta compartilham este valor. */
  cardId: string
  cardType: string
  variantId: string
  quantity: number
}

export interface CollectionTotals {
  totalCards: number
  uniqueVariants: number
  closedPlaysets: number
}

/**
 * Conta uma colecao inteira.
 *
 * Recebe a lista ja carregada porque a agregacao e barata e a regra e delicada:
 * mantendo-a aqui, os dez cenarios obrigatorios sao verificaveis sem banco, e
 * qualquer consulta que produza `OwnedVariant[]` herda a mesma contagem.
 */
export function countCollection(items: OwnedVariant[]): CollectionTotals {
  let totalCards = 0
  let uniqueVariants = 0
  const perCard = new Map<string, { type: string; quantity: number }>()

  for (const item of items) {
    if (item.quantity <= 0) continue

    totalCards += item.quantity
    uniqueVariants += 1

    const card = perCard.get(item.cardId)
    if (card) card.quantity += item.quantity
    else perCard.set(item.cardId, { type: item.cardType, quantity: item.quantity })
  }

  let closedPlaysets = 0
  for (const card of perCard.values()) {
    if (isPlaysetClosed(card.type, card.quantity)) closedPlaysets += 1
  }

  return { totalCards, uniqueVariants, closedPlaysets }
}

/**
 * Um playset fechado, ou nenhum. Nunca dois.
 *
 * O resultado e binario por carta: oito copias continuam sendo **um** playset.
 * `Math.floor(soma / 4)` e o erro obvio, e daria dois.
 */
export function isPlaysetClosed(cardType: string, quantityForCard: number): boolean {
  if (TYPES_WITHOUT_PLAYSET.has(cardType)) return false
  return quantityForCard >= PLAYSET_SIZE
}

export function countsTowardPlayset(cardType: string): boolean {
  return !TYPES_WITHOUT_PLAYSET.has(cardType)
}

/**
 * Progresso como fracao entre 0 e 1.
 *
 * Devolve a fracao, e nao a porcentagem arredondada: arredondar cedo apaga a
 * diferenca entre 124/125 e 249/250, e so um deles esta a uma carta do fim.
 * Quem exibe arredonda.
 *
 * Denominador zero e 0, e nao 1: um set sem nenhuma variante nao esta completo,
 * esta vazio.
 */
export function progress(owned: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(owned, total) / total
}
