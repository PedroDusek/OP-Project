/**
 * O estado de um want.
 *
 * Camada: domain. Puro, síncrono, sem I/O.
 *
 * Um want é uma variante e uma quantidade desejada (`business-rules.md` 4.4).
 * Não tem prioridade nem anotação: a tela de referência mostra um campo de
 * observação, e a regra diz o contrário — a regra vence, e o dono do produto
 * confirmou. O campo volta quando houver um uso concreto, provavelmente junto
 * de prioridade, que é a mesma conversa.
 *
 * Wants são **por variante**: a arte normal e a paralela da mesma carta são
 * dois wants independentes, porque quem quer a paralela não se satisfaz com a
 * normal.
 */

export type WantStatus = 'missing' | 'partial' | 'satisfied'

/**
 * Quanto ainda falta conseguir.
 *
 * Nunca negativo: ter mais do que se queria não é uma dívida ao contrário, é um
 * want satisfeito e ponto.
 */
export function remainingToGet(owned: number, wanted: number): number {
  return Math.max(0, wanted - Math.max(0, owned))
}

/**
 * Três estados, e não dois.
 *
 * "Tenho" e "não tenho" perderiam o caso mais comum de quem monta playset:
 * querer quatro e ter duas. `partial` é o que faz a lista dizer o tamanho do
 * que falta, em vez de repetir "não possuo" para tudo.
 */
export function wantStatus(owned: number, wanted: number): WantStatus {
  if (wanted <= 0) return 'satisfied'
  if (owned <= 0) return 'missing'
  return owned >= wanted ? 'satisfied' : 'partial'
}

export const WANT_STATUS_LABEL: Record<WantStatus, string> = {
  missing: 'Não possuo',
  partial: 'Tenho algumas',
  satisfied: 'Já consegui',
}

/**
 * O que o match pode cobrir (`business-rules.md` 4.3).
 *
 * Mora aqui, e não na tela de trocas, porque é aritmética de want e vale antes
 * de existir qualquer trade: é o mínimo entre o que a outra pessoa tem
 * disponível e o que ainda falta a esta.
 *
 * Um match é sugestão. Não cria obrigação e não é persistido.
 */
export function matchQuantity(availableForTrade: number, stillWanted: number): number {
  return Math.min(Math.max(0, availableForTrade), Math.max(0, stillWanted))
}
