import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseAuthProvider } from '@/server/infrastructure/auth/supabase-auth-provider'
import { AuthenticationError } from '@/server/domain/errors'

/**
 * O provedor do Supabase com o cliente de mentira, para o que o CAPTCHA muda
 * (decisão 088): o token chega ao Supabase, e a recusa vira uma mensagem clara —
 * inclusive na redefinição de senha, que engole todo 400.
 */

const auth = {
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signUp: vi.fn(),
}
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth }) }))

const recusa = { error: { status: 400, code: 'captcha_failed', message: 'captcha protection: request disallowed (no captcha response)' } }

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://projeto.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_teste')
  for (const fn of Object.values(auth)) fn.mockReset()
})

const provedor = () => new SupabaseAuthProvider({ getAll: () => [], set: () => {} })

describe('SupabaseAuthProvider e o CAPTCHA', () => {
  it('manda o token ao entrar, cadastrar e pedir redefinição', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null })
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null })
    auth.resetPasswordForEmail.mockResolvedValue({ error: null })

    await provedor().signInWithPassword('p@example.test', 'senha', 'tok')
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'p@example.test',
      password: 'senha',
      options: { captchaToken: 'tok' },
    })

    await provedor().signUp({ email: 'p@example.test', password: 'senha', name: 'P', redirectTo: 'https://x/cb', captchaToken: 'tok' })
    expect(auth.signUp.mock.calls[0][0].options).toMatchObject({ captchaToken: 'tok' })

    await provedor().sendPasswordReset('p@example.test', 'https://x/cb', 'tok')
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('p@example.test', { redirectTo: 'https://x/cb', captchaToken: 'tok' })
  })

  it('CAPTCHA recusado vira mensagem de verificação ao entrar', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: null }, ...recusa })
    const erro = await provedor().signInWithPassword('p@example.test', 'senha').catch((e) => e)
    expect(erro).toBeInstanceOf(AuthenticationError)
    expect(erro.message).toMatch(/robô/)
  })

  it('na redefinição, o CAPTCHA recusado sobe — e endereço desconhecido continua calado', async () => {
    auth.resetPasswordForEmail.mockResolvedValueOnce(recusa)
    await expect(provedor().sendPasswordReset('p@example.test', 'https://x/cb')).rejects.toThrow(/robô/)

    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { status: 400, message: 'User not found' } })
    await expect(provedor().sendPasswordReset('ninguem@example.test', 'https://x/cb')).resolves.toBeUndefined()
  })
})
