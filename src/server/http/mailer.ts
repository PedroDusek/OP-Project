/**
 * Contrato do envio de e-mail pelo ColeXa.
 *
 * Camada: http. Sem I/O: apenas o formato da operação.
 *
 * Existe pelo mesmo motivo do armazenamento de imagens (decisão 025): o caso de
 * uso não sabe que existe Resend, e os testes enviam para um provedor de
 * memória, sem rede.
 *
 * Só texto puro, de propósito. O corpo carrega texto escrito por usuário — o
 * motivo de uma denúncia —, e texto puro não tem marcação para injetar.
 *
 * Os e-mails de autenticação (confirmar conta, trocar senha) **não** passam por
 * aqui: quem manda é o Supabase, pelo SMTP configurado no painel (decisão 086).
 */

export interface EmailMessage {
  to: string
  subject: string
  text: string
  /**
   * Para onde vai a resposta. O feedback leva o e-mail de quem escreveu, e o
   * suporte responde direto a ela sem copiar endereço (decisão 096).
   */
  replyTo?: string
}

export interface Mailer {
  readonly name: string
  /** `false` quando o provedor não está configurado neste ambiente. */
  readonly available: boolean
  send(message: EmailMessage): Promise<void>
}
