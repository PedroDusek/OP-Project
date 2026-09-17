import { ValidationError } from '@/server/domain/errors'

/**
 * As conversas entre pessoas da rede (decisão 081).
 *
 * Camada: domain. Puro.
 */

/** O teto de uma mensagem, o mesmo da coluna. */
export const MESSAGE_MAX = 1000

/** Mensagens que a conversa mostra de uma vez: as mais recentes. */
export const CONVERSATION_PAGE = 200

/** O trecho da última mensagem na lista de conversas. */
export const SNIPPET_MAX = 80

/**
 * A chave do par: menor id primeiro. É ela que faz duas pessoas terem uma
 * conversa só, não importa quem abriu.
 */
export function conversationPairKey(a: bigint, b: bigint): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

/** O texto da mensagem: obrigatório, e com teto. Espaço nas pontas sai. */
export function normalizeMessageBody(raw: string | null | undefined): string {
  const body = (raw ?? '').trim()
  if (body.length === 0) throw new ValidationError('Escreva a mensagem antes de enviar.')
  if (body.length > MESSAGE_MAX) {
    throw new ValidationError(`A mensagem passou de ${MESSAGE_MAX} caracteres.`)
  }
  return body
}

/** O começo da mensagem, numa linha só, para a lista. */
export function messageSnippet(body: string): string {
  const linha = body.replace(/\s+/g, ' ').trim()
  return linha.length > SNIPPET_MAX ? `${linha.slice(0, SNIPPET_MAX - 1)}…` : linha
}

/**
 * Se a pessoa pode escrever nesta conversa.
 *
 * A regra 6.1.4 diz que quem foi bloqueado não inicia conversa com quem
 * bloqueou. O dono do produto aprovou estender: nem manda mensagem numa conversa
 * que já existia. Quem bloqueou também não escreve para quem bloqueou, que não
 * poderia responder — para voltar a conversar, desbloqueia (decisão 081, de
 * implementação).
 */
export function sendBlockedReason(block: { viewerBlockedOther: boolean; otherBlockedViewer: boolean }): string | null {
  if (block.viewerBlockedOther) return 'Você bloqueou esta pessoa. Desbloqueie para voltar a conversar.'
  if (block.otherBlockedViewer) return 'Não é possível enviar mensagens para esta pessoa.'
  return null
}
