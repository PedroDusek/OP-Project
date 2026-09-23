import { DON_TYPE } from '@/server/domain/catalog/types'

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
 * `Leader` porque um deck usa exatamente um. `DON` porque ele nao e carta de
 * deck: um deck usa dez, iguais, e "quantas copias faltam para quatro" nao e
 * uma pergunta que alguem faca sobre DON!!. O que se conta dele e quantos
 * **diferentes** a pessoa tem (decisao 112), e isso nao e playset.
 *
 * Este comentario dizia "se um dia entrar, entra nesta lista". Entrou em 23/09.
 */
const TYPES_WITHOUT_PLAYSET = new Set(['Leader', 'DON'])

export interface OwnedVariant {
  /** Agrupa o playset. Duas artes da mesma carta compartilham este valor. */
  cardId: string
  cardType: string
  variantId: string
  quantity: number
}

export interface CollectionTotals {
  totalCards: number
  /**
   * Variantes distintas possuidas, **sem DON!!**.
   *
   * Este e o numerador do progresso do catalogo, e o denominador tambem exclui
   * DON!! (decisao 112). Os dois precisam concordar: contar DON!! de um lado e
   * nao do outro faria o progresso passar de 100%.
   */
  uniqueVariants: number
  closedPlaysets: number
  /**
   * Quantos DON!! **diferentes** a pessoa tem.
   *
   * Fica fora do progresso de proposito, por escolha do dono do produto: o
   * DON!! nao e carta de deck e nao ha "faltam N para completar". O que a tela
   * diz e "voce possui X DON diferentes", e este e o X.
   */
  donVariants: number
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
  let donVariants = 0
  const perCard = new Map<string, { type: string; quantity: number }>()

  for (const item of items) {
    if (item.quantity <= 0) continue

    // Um DON!! possuido e uma carta possuida: ele conta no total. O que ele nao
    // faz e mexer no progresso, e por isso sai so de `uniqueVariants`.
    totalCards += item.quantity
    if (item.cardType === DON_TYPE) donVariants += 1
    else uniqueVariants += 1

    const card = perCard.get(item.cardId)
    if (card) card.quantity += item.quantity
    else perCard.set(item.cardId, { type: item.cardType, quantity: item.quantity })
  }

  let closedPlaysets = 0
  for (const card of perCard.values()) {
    if (isPlaysetClosed(card.type, card.quantity)) closedPlaysets += 1
  }

  return { totalCards, uniqueVariants, closedPlaysets, donVariants }
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
