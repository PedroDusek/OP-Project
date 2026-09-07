import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  requestPasswordReset,
  signIn,
  signOut,
  signUp,
  startOAuth,
} from '@/server/application/auth/credentials'
import { setAuthProviderFactory } from '@/server/application/auth'
import { AUTH_ATTEMPT_LIMIT, EMAIL_SEND_LIMIT, resetRateLimits } from '@/server/http/rate-limit'
import { AuthenticationError, ValidationError } from '@/server/domain/errors'
import type { AuthProvider, CookieStore, SignUpInput } from '@/server/http/auth-provider'

/**
 * Os casos de uso de conta, contra um provedor falso.
 *
 * Sem rede e sem banco de proposito: o que se testa aqui e o que **nos**
 * garantimos — validacao, limite de tentativa, e o que e passado ao provedor.
 * Se o Supabase autentica corretamente nao e coisa que este projeto deva
 * afirmar por teste (decisao 025).
 */

interface Call {
  method: string
  args: unknown[]
}

let calls: Call[] = []
let signUpResult = { needsEmailConfirmation: true }
let nextError: Error | null = null

const record = (method: string, ...args: unknown[]) => {
  calls.push({ method, args })
  if (nextError) {
    const error = nextError
    nextError = null
    throw error
  }
}

const fakeProvider: AuthProvider = {
  name: 'falso',
  async signUp(input: SignUpInput) {
    record('signUp', input)
    return signUpResult
  },
  async signInWithPassword(email, password) {
    record('signInWithPassword', email, password)
  },
  async signOut() {
    record('signOut')
  },
  async sendPasswordReset(email, redirectTo) {
    record('sendPasswordReset', email, redirectTo)
  },
  async updatePassword(password) {
    record('updatePassword', password)
  },
  async exchangeCodeForSession(code) {
    record('exchangeCodeForSession', code)
  },
  async oauthUrl(provider, redirectTo) {
    record('oauthUrl', provider, redirectTo)
    return `https://provedor.test/${provider}?redirect=${encodeURIComponent(redirectTo)}`
  },
}

const noCookies: CookieStore = { getAll: () => [], set: () => {} }
const deps = { cookies: noCookies, appUrl: 'https://colexa.com.br' }

const lastCall = (method: string) => calls.filter((call) => call.method === method).at(-1)

beforeEach(() => {
  calls = []
  nextError = null
  signUpResult = { needsEmailConfirmation: true }
  resetRateLimits()
  setAuthProviderFactory(() => fakeProvider)
})

afterAll(() => {
  setAuthProviderFactory(null)
})

describe('entrar', () => {
  it('normaliza o e-mail antes de chamar o provedor', async () => {
    await signIn({ email: '  Pessoa@Example.TEST ', password: 'senha-boa' }, deps)

    expect(lastCall('signInWithPassword')?.args).toEqual(['pessoa@example.test', 'senha-boa'])
  })

  it('recusa e-mail malformado sem chamar o provedor', async () => {
    await expect(signIn({ email: 'nao-e-email', password: 'x' }, deps)).rejects.toBeInstanceOf(
      ValidationError,
    )
    expect(calls).toHaveLength(0)
  })

  it('exige senha', async () => {
    const error = await signIn({ email: 'p@example.test', password: '' }, deps).catch((e) => e)
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).fields.password).toBeDefined()
  })

  /**
   * A cota conta **toda** tentativa, e nao so as que falham. Contar apenas as
   * falhas deixaria a cota infinita para quem acerta, e a cota existe
   * justamente contra quem esta chutando ate acertar.
   */
  it('limita tentativas por endereco, acertando ou errando', async () => {
    for (let attempt = 0; attempt < AUTH_ATTEMPT_LIMIT.limit; attempt++) {
      await signIn({ email: 'alvo@example.test', password: 'certa' }, deps)
    }

    await expect(signIn({ email: 'alvo@example.test', password: 'certa' }, deps)).rejects.toThrow(
      /muitas tentativas/i,
    )
  })

  it('a cota de um endereco nao afeta outro', async () => {
    for (let attempt = 0; attempt < AUTH_ATTEMPT_LIMIT.limit; attempt++) {
      await signIn({ email: 'alvo@example.test', password: 'x1234567' }, deps)
    }

    await expect(
      signIn({ email: 'outra@example.test', password: 'x1234567' }, deps),
    ).resolves.toBeUndefined()
  })

  it('repassa a falha do provedor sem enfeitar', async () => {
    nextError = new AuthenticationError('E-mail ou senha incorretos.')
    await expect(signIn({ email: 'p@example.test', password: 'errada' }, deps)).rejects.toThrow(
      'E-mail ou senha incorretos.',
    )
  })
})

describe('criar conta', () => {
  const valid = {
    name: 'Pessoa Exemplo',
    email: 'Nova@Example.test',
    password: 'senha-de-oito',
    passwordConfirmation: 'senha-de-oito',
    acceptedTerms: true,
  }

  it('manda nome, e-mail normalizado e o retorno da confirmacao', async () => {
    const outcome = await signUp(valid, deps)

    expect(outcome).toEqual({ needsEmailConfirmation: true, email: 'nova@example.test' })
    expect(lastCall('signUp')?.args[0]).toEqual({
      name: 'Pessoa Exemplo',
      email: 'nova@example.test',
      password: 'senha-de-oito',
      redirectTo: 'https://colexa.com.br/auth/callback?next=%2Finicio',
    })
  })

  it('avisa quando o provedor ja deixou a sessao pronta', async () => {
    signUpResult = { needsEmailConfirmation: false }
    await expect(signUp(valid, deps)).resolves.toMatchObject({ needsEmailConfirmation: false })
  })

  it('recusa senha curta', async () => {
    const error = await signUp({ ...valid, password: 'curta', passwordConfirmation: 'curta' }, deps).catch(
      (e) => e,
    )
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).fields.password?.[0]).toMatch(/8 caracteres/)
    expect(calls).toHaveLength(0)
  })

  it('recusa confirmacao diferente, apontando o campo certo', async () => {
    const error = await signUp({ ...valid, passwordConfirmation: 'outra-senha' }, deps).catch((e) => e)
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).fields.passwordConfirmation?.[0]).toMatch(/não coincidem/i)
  })

  /** A tela 03 exige o aceite; a regra vale no servidor, nao so na caixa. */
  it('recusa sem aceite dos termos', async () => {
    const error = await signUp({ ...valid, acceptedTerms: false }, deps).catch((e) => e)
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).fields.acceptedTerms).toBeDefined()
    expect(calls).toHaveLength(0)
  })

  it('limita cadastros seguidos com o mesmo endereco', async () => {
    for (let attempt = 0; attempt < EMAIL_SEND_LIMIT.limit; attempt++) {
      await signUp(valid, deps)
    }
    await expect(signUp(valid, deps)).rejects.toThrow(/muitas tentativas/i)
  })
})

describe('redefinir senha', () => {
  it('pede o e-mail com o retorno para a tela de nova senha', async () => {
    await requestPasswordReset({ email: 'Pessoa@Example.test' }, deps)

    expect(lastCall('sendPasswordReset')?.args).toEqual([
      'pessoa@example.test',
      'https://colexa.com.br/auth/callback?next=%2Fnova-senha',
    ])
  })

  /**
   * O caso de uso devolve `void` tanto para endereco existente quanto para
   * inexistente. Responder diferente transformaria a tela numa consulta de quem
   * tem conta no produto.
   */
  it('nao distingue endereco conhecido de desconhecido', async () => {
    await expect(requestPasswordReset({ email: 'quem@example.test' }, deps)).resolves.toBeUndefined()
  })

  it('limita envios seguidos para o mesmo endereco', async () => {
    for (let attempt = 0; attempt < EMAIL_SEND_LIMIT.limit; attempt++) {
      await requestPasswordReset({ email: 'alvo@example.test' }, deps)
    }
    await expect(requestPasswordReset({ email: 'alvo@example.test' }, deps)).rejects.toThrow(
      /muitas tentativas/i,
    )
  })
})

describe('sair', () => {
  it('chama o provedor', async () => {
    await signOut(deps)
    expect(lastCall('signOut')).toBeDefined()
  })
})

describe('provedor social', () => {
  it('monta o retorno para o caminho pedido', async () => {
    const url = await startOAuth('google', deps, '/colecao')

    expect(lastCall('oauthUrl')?.args).toEqual([
      'google',
      'https://colexa.com.br/auth/callback?next=%2Fcolecao',
    ])
    expect(url).toContain('https://provedor.test/google')
  })

  /**
   * `next` chega da query string. Sem esta checagem, `/entrar?next=https://…`
   * faria a nossa propria tela mandar a pessoa para fora logo depois de ela
   * digitar a senha.
   */
  it.each(['https://outrolugar.test/phishing', '//outrolugar.test', 'sem-barra'])(
    'ignora destino externo: %s',
    async (destino) => {
      await startOAuth('google', deps, destino)

      expect(lastCall('oauthUrl')?.args[1]).toBe(
        'https://colexa.com.br/auth/callback?next=%2Finicio',
      )
    },
  )
})
