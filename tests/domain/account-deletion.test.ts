import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  anonymizedEmail,
  assertDeletionConfirmed,
  deletionCutoff,
  deletionDueAt,
} from '@/server/domain/account/deletion'
import { deletionRequestEmail } from '@/server/domain/account/deletion-email'
import { ValidationError } from '@/server/domain/errors'

/** Excluir a conta: prazo, confirmação e o que a conta vira (decisões 015 e 091). */

describe('o prazo', () => {
  it('são 30 dias, definidos pelo dono do produto', () => {
    expect(ACCOUNT_DELETION_GRACE_DAYS).toBe(30)
    expect(deletionDueAt(new Date('2026-09-17T12:00:00Z'))).toEqual(new Date('2026-10-17T12:00:00Z'))
  })

  it('a linha de corte é o prazo contado para trás: quem pediu nela já venceu', () => {
    const agora = new Date('2026-10-17T12:00:00Z')
    expect(deletionCutoff(agora)).toEqual(new Date('2026-09-17T12:00:00Z'))
    expect(deletionDueAt(deletionCutoff(agora))).toEqual(agora)
  })
})

describe('a confirmação', () => {
  it('aceita EXCLUIR sem ligar para maiúsculas e espaços nas pontas', () => {
    expect(() => assertDeletionConfirmed('EXCLUIR')).not.toThrow()
    expect(() => assertDeletionConfirmed('  excluir ')).not.toThrow()
  })

  it('recusa qualquer outra coisa, com o erro no campo', () => {
    for (const errado of ['', 'sim', 'EXCLUI', 'EXCLUIR CONTA', null, undefined]) {
      expect(() => assertDeletionConfirmed(errado)).toThrow(ValidationError)
    }
    try {
      assertDeletionConfirmed('não')
    } catch (error) {
      expect((error as ValidationError).fields).toEqual({ confirmacao: ['Digite EXCLUIR para confirmar.'] })
    }
  })
})

describe('o e-mail anonimizado', () => {
  it('não reversível, único por conta, num domínio que não recebe e-mail', () => {
    expect(anonymizedEmail(42n)).toBe('deleted+42@deleted.invalid')
  })
})

describe('o e-mail do pedido', () => {
  it('diz a data por extenso, no horário de Brasília, e como desistir', () => {
    // 02:00 UTC de 17/10 ainda e 16/10 em Brasilia.
    const email = deletionRequestEmail({
      to: 'ana@example.test',
      name: 'Ana',
      dueAt: new Date('2026-10-17T02:00:00Z'),
      appUrl: 'https://colexa.com.br/',
    })
    expect(email.to).toBe('ana@example.test')
    expect(email.text).toContain('será excluída em 16 de outubro de 2026')
    expect(email.text).toContain('Entrar: https://colexa.com.br/entrar')
    expect(email.text).toContain('Conta excluída')
  })
})
