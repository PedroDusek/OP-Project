/**
 * A negociação de uma troca: quem confirmou o quê, e o que derruba isso.
 *
 * Camada: domain. Puro, síncrono, sem I/O.
 *
 * ## O que uma confirmação significa
 *
 * Que aquela pessoa concorda com **a troca que está na tela agora**. É a única
 * leitura que serve: se a confirmação sobrevivesse a uma alteração, ninguém
 * saberia se o outro concordou com o que vê ou com uma versão anterior — e o
 * gesto de confirmar perderia o sentido.
 *
 * Daí a regra: **qualquer alteração revoga todas as confirmações**
 * (`business-rules.md` 4.6.3). As duas, e não só a do outro. Quem confirmou e
 * em seguida mudou a própria oferta não confirmou esta.
 *
 * ## Nada aqui sabe de banco
 *
 * As funções recebem o estado e devolvem o estado seguinte. Quem persiste é a
 * camada de aplicação, e é ela que garante que ninguém mexe na oferta alheia —
 * isso é autorização, não aritmética.
 */

export type TradeStatus =
  | 'DRAFT'
  | 'PROPOSED'
  | 'NEGOTIATING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'

/** Os estados em que a troca prende cópias e impede outra (regra 4.5). */
export const ACTIVE_TRADE_STATUSES: readonly TradeStatus[] = [
  'PROPOSED',
  'NEGOTIATING',
  'CONFIRMED',
]

export function isActiveTrade(status: TradeStatus): boolean {
  return ACTIVE_TRADE_STATUSES.includes(status)
}

export interface Participant {
  userId: bigint
  /** Quando esta pessoa confirmou a troca como ela está. Nulo se não confirmou. */
  confirmedAt: Date | null
}

/**
 * A troca está validada quando os dois confirmaram.
 *
 * "Os dois", e não "todos": um trade efetivo tem exatamente dois participantes
 * (regra 4.5). Com um só, ainda falta alguém entrar, e uma confirmação sozinha
 * não vale — foi o consentimento do segundo que autorizou o cruzamento dos
 * dados, e é o dele que fecha a troca.
 */
export function isValidated(participants: readonly Participant[]): boolean {
  return participants.length === 2 && participants.every((p) => p.confirmedAt !== null)
}

/**
 * O estado dos participantes depois de alguém alterar a troca.
 *
 * Devolve todo mundo sem confirmação. Simples de propósito: a alternativa —
 * preservar a confirmação de quem alterou — parece gentileza e é armadilha,
 * porque a pessoa passaria a estar confirmada numa troca diferente da que
 * aceitou.
 */
export function revokeConfirmations(
  participants: readonly Participant[],
): Participant[] {
  return participants.map((participant) => ({ ...participant, confirmedAt: null }))
}

/**
 * Alguém precisa reconfirmar por causa desta alteração?
 *
 * Serve para a tela decidir se avisa. Só há o que avisar quando havia
 * confirmação para perder: numa troca que ninguém confirmou ainda, alterar é o
 * curso normal da conversa e um alerta ali seria ruído.
 */
export function needsReconfirmation(participants: readonly Participant[]): boolean {
  return participants.some((participant) => participant.confirmedAt !== null)
}

/**
 * Quem precisa ser avisado de uma alteração feita por `changedBy`.
 *
 * Quem alterou sabe o que fez; avisar a própria pessoa do próprio gesto é
 * ruído. Só entra quem tinha confirmado — quem não tinha não perdeu nada e vai
 * ver a alteração na tela de qualquer jeito.
 */
export function participantsToNotify(
  participants: readonly Participant[],
  changedBy: bigint,
): bigint[] {
  return participants
    .filter((p) => p.userId !== changedBy && p.confirmedAt !== null)
    .map((p) => p.userId)
}

/**
 * O status depois de uma alteração, quando o trade já estava confirmado.
 *
 * `CONFIRMED` é o estado dos dois de acordo. Alterar desfaz isso, e o trade
 * volta a `NEGOTIATING` — que é onde ele estava enquanto se conversava. Os
 * demais estados não mudam por alteração: `DRAFT` e `PROPOSED` ainda nem
 * chegaram lá, e `COMPLETED` e `CANCELLED` não aceitam alteração nenhuma.
 */
export function statusAfterChange(status: TradeStatus): TradeStatus {
  return status === 'CONFIRMED' ? 'NEGOTIATING' : status
}

/**
 * A troca aceita alteração neste estado?
 *
 * Concluída não: o valor histórico de um trade sai do preço vigente em
 * `completed_at` (regra 5.1), e mexer nos itens depois disso reescreveria o
 * passado. Cancelada também não — não há o que negociar.
 */
export function acceptsChanges(status: TradeStatus): boolean {
  return status !== 'COMPLETED' && status !== 'CANCELLED'
}
