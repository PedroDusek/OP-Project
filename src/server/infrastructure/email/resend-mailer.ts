import type { EmailMessage, Mailer } from '@/server/http/mailer'

/**
 * E-mail pelo Resend (decisão 086).
 *
 * Camada: infrastructure.
 *
 * `fetch` direto na API, e não o pacote `resend`: é um endpoint e um cabeçalho,
 * o mesmo raciocínio do Storage (`supabase-image-storage.ts`).
 *
 * ## Ausente é diferente de quebrado
 *
 * Sem `RESEND_API_KEY` ou `EMAIL_FROM` o provedor se declara indisponível. O
 * desenvolvimento local não precisa de conta no Resend para o resto funcionar, e
 * a denúncia continua gravada no banco.
 *
 * O remetente precisa ser de um domínio verificado no Resend — `colexa.com.br`.
 * De outro domínio, a API responde 403 e o e-mail não sai.
 */

const ENDPOINT = 'https://api.resend.com/emails'

/** A denúncia já está gravada; esperar mais que isto só segura a tela. */
const TIMEOUT_MS = 10_000

interface Config {
  apiKey: string
  from: string
}

function readConfig(): Config | null {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.EMAIL_FROM?.trim()
  if (!apiKey || !from) return null
  return { apiKey, from }
}

export class ResendMailer implements Mailer {
  readonly name = 'resend'

  get available(): boolean {
    return readConfig() !== null
  }

  async send({ to, subject, text }: EmailMessage): Promise<void> {
    const config = readConfig()
    if (!config) throw new Error('RESEND_API_KEY e EMAIL_FROM precisam estar definidas.')

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.from, to: [to], subject, text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) {
      // A mensagem do Resend diz o que houve (domínio não verificado, chave
      // inválida) e não repete a chave nem o conteúdo.
      const body = await response.text().catch(() => '')
      let detail = body
      try {
        const parsed = JSON.parse(body) as { message?: string }
        detail = parsed.message || body
      } catch {
        // Corpo que não é JSON já serve como está.
      }
      throw new Error(`Falha ao enviar e-mail: ${response.status} ${detail}`.trim())
    }
  }
}
