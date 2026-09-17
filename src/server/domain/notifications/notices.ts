/**
 * Os avisos do sino (decisão 080).
 *
 * Camada: domain. Puro.
 *
 * ## Estado atual, e não histórico
 *
 * Escolha do dono do produto: o sino mostra o que está pendente **agora**, e o
 * aviso some sozinho quando a pessoa resolve. Não há notificação guardada, nem
 * "marcar como lida" — o que se lê é o próprio assunto. Por isso não há tabela:
 * cada aviso é calculado na leitura, e não pode divergir do que ele descreve.
 *
 * O pontinho aparece enquanto houver algum aviso.
 */

export type Notice =
  | {
      kind: 'unallocated-cards'
      /** Cópias sem lugar, somadas. */
      copies: number
      /** Cartas diferentes com cópia sem lugar. */
      cards: number
    }

/**
 * O aviso das cartas sem armazenamento, quando cabe.
 *
 * Sem local nenhum criado, não avisa: **tudo** estaria sem lugar, e o convite
 * seria um beco — é a mesma regra do lembrete em Binders, onde quem fala nesse
 * caso é o estado vazio que manda criar o primeiro.
 */
export function unallocatedNotice(
  summary: { copies: number; cards: number },
  hasStorageLocations: boolean,
): Notice | null {
  if (!hasStorageLocations || summary.copies <= 0) return null
  return { kind: 'unallocated-cards', copies: summary.copies, cards: summary.cards }
}
