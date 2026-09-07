import { describe, expect, it, vi } from 'vitest'
import { formErrorFrom } from '@/server/http/form-state'
import {
  AuthenticationError,
  ConflictError,
  RateLimitError,
  ValidationError,
} from '@/server/domain/errors'

const silent = { error: vi.fn() }

describe('formErrorFrom', () => {
  it('devolve os erros por campo, na chave do input', () => {
    const state = formErrorFrom(
      new ValidationError('Dados invalidos.', {
        email: ['Esse e-mail não parece válido.'],
        password: ['A senha precisa ter ao menos 8 caracteres.'],
      }),
    )

    expect(state.fields.email).toEqual(['Esse e-mail não parece válido.'])
    expect(state.fields.password).toHaveLength(1)
  })

  /**
   * Com erro por campo, a mensagem geral fica vazia. Repetir "Dados inválidos"
   * acima de campos que já dizem o que há de errado só acrescenta ruído a uma
   * tela que a pessoa está tentando resolver.
   */
  it('cala a mensagem geral quando ha erro por campo', () => {
    const state = formErrorFrom(new ValidationError('Dados invalidos.', { email: ['Inválido.'] }))
    expect(state.message).toBe('')
  })

  it('mantem a mensagem geral quando o erro nao tem campo', () => {
    const state = formErrorFrom(new ValidationError('Dados invalidos.'))
    expect(state.message).toBe('Dados invalidos.')
  })

  it('repassa a mensagem de autenticacao', () => {
    const state = formErrorFrom(new AuthenticationError('E-mail ou senha incorretos.'))
    expect(state.message).toBe('E-mail ou senha incorretos.')
    expect(state.fields).toEqual({})
  })

  it('traduz o limite de taxa em segundos', () => {
    expect(formErrorFrom(new RateLimitError(30)).message).toMatch(/30 segundos/)
  })

  it('traduz o limite longo em minutos', () => {
    expect(formErrorFrom(new RateLimitError(600)).message).toMatch(/10 minutos/)
  })

  it('repassa conflito de dominio', () => {
    const state = formErrorFrom(new ConflictError('ALGO', 'Conflito com o estado atual.'))
    expect(state.message).toBe('Conflito com o estado atual.')
  })

  /**
   * Erro inesperado nunca chega ao cliente com detalhe. O que sai e uma
   * mensagem generica com um identificador; o resto fica no log.
   */
  it('esconde erro inesperado atras de um identificador', () => {
    const logger = { error: vi.fn() }
    const state = formErrorFrom(new Error('SELECT * FROM users WHERE senha = ...'), logger)

    expect(state.message).not.toContain('SELECT')
    expect(state.message).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/)
    expect(logger.error).toHaveBeenCalledOnce()
  })

  it('nao loga erro de dominio', () => {
    formErrorFrom(new AuthenticationError(), silent)
    expect(silent.error).not.toHaveBeenCalled()
  })
})
