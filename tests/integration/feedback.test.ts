import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedUser } from '@/server/application/auth'
import { sendFeedback } from '@/server/application/account/feedback'
import { feedbackEmail, normalizeFeedback, FEEDBACK_MAX } from '@/server/domain/account/feedback'
import { ConflictError, RateLimitError, ValidationError } from '@/server/domain/errors'
import type { EmailMessage, Mailer } from '@/server/http/mailer'
import { FEEDBACK_LIMIT, resetRateLimits } from '@/server/http/rate-limit'
import { createUser, disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * O feedback (decisão 096).
 *
 * Regras do dono do produto: vai por e-mail para suporte@colexa.com.br com o
 * assunto FEEDBACK. Não é guardado — por isso falha de envio é erro para quem
 * escreveu, e não silêncio.
 */

let enviados: EmailMessage[] = []
const mailer: Mailer = { name: 'memoria', available: true, send: async (m) => void enviados.push(m) }

async function pessoa(username: string | null = 'ana'): Promise<AuthenticatedUser> {
  const criada = await createUser('Ana')
  await testPrisma().user.update({ where: { id: criada.id }, data: { username } })
  return { id: criada.id, email: criada.email, name: 'Ana', plan: 'FREE', premiumUntil: null }
}

beforeEach(async () => {
  await resetDatabase()
  resetRateLimits()
  enviados = []
})

afterAll(async () => {
  await disconnect()
})

describe('o texto', () => {
  it('recusa vazio e comprido demais, com o erro no campo', () => {
    expect(() => normalizeFeedback('   ')).toThrow(ValidationError)
    expect(() => normalizeFeedback('a'.repeat(FEEDBACK_MAX + 1))).toThrow(/caracteres/)
    expect(normalizeFeedback('  Adorei o deck builder.  ')).toBe('Adorei o deck builder.')
  })

  it('o e-mail diz quem escreveu, e a mensagem vem por último', () => {
    const email = feedbackEmail(
      { name: 'Ana', email: 'ana@example.test', username: 'ana', premium: true },
      'De: alguém falso\nlinha dois',
      new Date('2026-09-18T15:00:00Z'),
    )
    expect(email).toMatchObject({ to: 'suporte@colexa.com.br', subject: 'FEEDBACK', replyTo: 'ana@example.test' })
    expect(email.text).toContain('De: Ana <ana@example.test>')
    expect(email.text).toContain('Nome na rede: @ana')
    expect(email.text).toContain('Plano: Premium')
    expect(email.text).toContain('18/09/2026, 12:00')
    expect(email.text.indexOf('De: Ana')).toBeLessThan(email.text.indexOf('De: alguém falso'))
  })
})

describe('mandar', () => {
  it('chega ao suporte com o assunto FEEDBACK, e responder vai para quem escreveu', async () => {
    const ana = await pessoa()
    await sendFeedback(testPrisma(), mailer, ana, 'A busca do deck podia filtrar por custo.')

    expect(enviados).toHaveLength(1)
    expect(enviados[0]).toMatchObject({ to: 'suporte@colexa.com.br', subject: 'FEEDBACK', replyTo: ana.email })
    expect(enviados[0].text).toContain('A busca do deck podia filtrar por custo.')
  })

  it('quem ainda não escolheu nome na rede também manda', async () => {
    const semNome = await pessoa(null)
    await sendFeedback(testPrisma(), mailer, semNome, 'Oi.')
    expect(enviados[0].text).toContain('Nome na rede: (ainda não escolheu)')
  })

  it('sem provedor de e-mail, avisa — não finge que mandou', async () => {
    const ana = await pessoa()
    const ausente: Mailer = { name: 'ausente', available: false, send: vi.fn() }
    await expect(sendFeedback(testPrisma(), ausente, ana, 'Oi.')).rejects.toBeInstanceOf(ConflictError)
    expect(ausente.send).not.toHaveBeenCalled()
  })

  it('envio que falha é erro para quem escreveu, e o log não leva a mensagem', async () => {
    const ana = await pessoa()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const quebrado: Mailer = { name: 'quebrado', available: true, send: async () => { throw new Error('403') } }

    await expect(sendFeedback(testPrisma(), quebrado, ana, 'Mensagem secreta.')).rejects.toThrow(/Tente de novo/)
    expect(JSON.stringify(log.mock.calls)).not.toContain('Mensagem secreta.')
    log.mockRestore()
  })

  it('tem cota por pessoa', async () => {
    const ana = await pessoa()
    for (let i = 0; i < FEEDBACK_LIMIT.limit; i++) await sendFeedback(testPrisma(), mailer, ana, `Mensagem ${i}`)
    await expect(sendFeedback(testPrisma(), mailer, ana, 'Mais uma.')).rejects.toBeInstanceOf(RateLimitError)
  })
})
