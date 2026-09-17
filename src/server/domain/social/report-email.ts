/**
 * O e-mail que avisa o suporte de uma denúncia (decisão 086).
 *
 * Camada: domain. Puro: monta o texto, não envia.
 *
 * Endereço e assunto definidos pelo dono do produto em 17/09: toda denúncia
 * chega em `suporte@colexa.com.br` com o assunto `DENUNCIA`, sem acento, para o
 * filtro da caixa de entrada pegar sempre igual.
 */

export const REPORT_EMAIL_TO = 'suporte@colexa.com.br'
export const REPORT_EMAIL_SUBJECT = 'DENUNCIA'

export interface ReportEmailInput {
  reportId: bigint
  createdAt: Date
  reporter: { username: string | null; email: string }
  reported: { username: string; email: string }
  reason: string
}

const quando = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

/**
 * Texto puro. O motivo vai como a pessoa escreveu, depois das linhas fixas, para
 * nenhum texto de usuário se passar por um campo do e-mail.
 */
export function reportEmail(input: ReportEmailInput) {
  const nome = (username: string | null) => (username ? `@${username}` : '(sem nome na rede)')
  const text = [
    `Denúncia nº ${input.reportId}, em ${quando.format(input.createdAt)} (horário de Brasília).`,
    '',
    `Denunciada: ${nome(input.reported.username)} <${input.reported.email}>`,
    `Quem denunciou: ${nome(input.reporter.username)} <${input.reporter.email}>`,
    '',
    'Motivo, como foi escrito:',
    '',
    input.reason,
  ].join('\n')

  return { to: REPORT_EMAIL_TO, subject: REPORT_EMAIL_SUBJECT, text }
}
