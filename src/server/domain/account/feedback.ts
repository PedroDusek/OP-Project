import { ValidationError } from '@/server/domain/errors'

/**
 * O feedback de quem usa o ColeXa (decisão 096).
 *
 * Camada: domain. Puro: confere o texto e monta o e-mail.
 *
 * Endereço e assunto definidos pelo dono do produto em 18/09: tudo chega em
 * `suporte@colexa.com.br` com o assunto `FEEDBACK`, sem acento, para o filtro da
 * caixa de entrada pegar sempre igual — como a denúncia (decisão 086).
 */

export const FEEDBACK_EMAIL_TO = 'suporte@colexa.com.br'
export const FEEDBACK_EMAIL_SUBJECT = 'FEEDBACK'
export const FEEDBACK_MAX = 2000

export function normalizeFeedback(raw: string | null | undefined): string {
  const texto = (raw ?? '').trim()
  if (texto.length === 0) {
    throw new ValidationError('Escreva o que você quer contar.', { mensagem: ['Escreva o que você quer contar.'] })
  }
  if (texto.length > FEEDBACK_MAX) {
    throw new ValidationError(`A mensagem passou de ${FEEDBACK_MAX} caracteres.`, {
      mensagem: [`No máximo ${FEEDBACK_MAX} caracteres.`],
    })
  }
  return texto
}

export interface FeedbackAuthor {
  name: string
  email: string
  username: string | null
  premium: boolean
}

const quando = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

/**
 * Texto puro, com o texto da pessoa por último, depois das linhas fixas — o
 * mesmo cuidado da denúncia: nada escrito por usuário se passa por um campo.
 */
export function feedbackEmail(author: FeedbackAuthor, message: string, sentAt: Date) {
  const text = [
    `Feedback enviado em ${quando.format(sentAt)} (horário de Brasília).`,
    '',
    `De: ${author.name} <${author.email}>`,
    `Nome na rede: ${author.username ? `@${author.username}` : '(ainda não escolheu)'}`,
    `Plano: ${author.premium ? 'Premium' : 'Free'}`,
    '',
    'Mensagem, como foi escrita:',
    '',
    message,
  ].join('\n')

  return { to: FEEDBACK_EMAIL_TO, subject: FEEDBACK_EMAIL_SUBJECT, text, replyTo: author.email }
}
