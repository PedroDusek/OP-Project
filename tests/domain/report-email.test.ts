import { describe, expect, it } from 'vitest'
import { reportEmail } from '@/server/domain/social/report-email'

/** O texto do e-mail da denúncia (decisão 086). */

const base = {
  reportId: 42n,
  createdAt: new Date('2026-09-17T15:30:00Z'),
  reporter: { username: 'eu', email: 'eu@example.test' },
  reported: { username: 'ana', email: 'ana@example.test' },
  reason: 'Pediu pagamento adiantado.',
  appUrl: 'https://colexa.com.br/',
}

describe('reportEmail', () => {
  it('vai para o suporte, com o assunto que o filtro espera', () => {
    const email = reportEmail(base)
    expect(email.to).toBe('suporte@colexa.com.br')
    expect(email.subject).toBe('DENUNCIA')
  })

  it('diz quem, quando, o motivo e onde ver as outras — no horário de Brasília', () => {
    const { text } = reportEmail(base)
    expect(text).toContain('Denúncia nº 42, em 17/09/2026, 12:30 (horário de Brasília).')
    expect(text).toContain('Denunciada: @ana <ana@example.test>')
    expect(text).toContain('Quem denunciou: @eu <eu@example.test>')
    expect(text).toContain('https://colexa.com.br/admin/denuncias')
  })

  it('o motivo vem por último, depois das linhas fixas, e quem denunciou pode não ter nome', () => {
    const reason = 'Denunciada: @outra <falso@example.test>\nlinha dois'
    const { text } = reportEmail({ ...base, reason, reporter: { username: null, email: 'x@example.test' } })
    expect(text).toContain('Quem denunciou: (sem nome na rede) <x@example.test>')
    expect(text.indexOf('Denunciada: @ana')).toBeLessThan(text.indexOf(reason))
    expect(text).toContain(reason)
  })
})
