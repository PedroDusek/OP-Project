import { createServerClient } from '@supabase/ssr'
import { AuthenticationError, ValidationError } from '@/server/domain/errors'
import type {
  AuthProvider,
  CookieStore,
  OAuthAvailability,
  OAuthProviderId,
  SignUpInput,
  SignUpResult,
} from '@/server/http/auth-provider'

/**
 * Credenciais no Supabase Auth (decisao 025).
 *
 * Camada: infrastructure.
 *
 * A senha vai do formulario para o servidor e do servidor para o Supabase. Nao
 * existe cliente Supabase no pacote do navegador: entrar e cadastrar sao Server
 * Actions. Isso mantem a regra do projeto de que o servidor e a fronteira, e
 * tira do bundle a chave e a logica de autenticacao.
 */

interface SupabaseConfig {
  url: string
  publishableKey: string
}

function readConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !publishableKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY precisam estar definidas.',
    )
  }
  return { url, publishableKey }
}

export class SupabaseAuthProvider implements AuthProvider {
  readonly name = 'supabase'

  constructor(private readonly cookies: CookieStore) {}

  private client() {
    const { url, publishableKey } = readConfig()
    return createServerClient(url, publishableKey, {
      cookies: {
        getAll: () => this.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            this.cookies.set(name, value, options ?? {})
          }
        },
      },
    })
  }

  async signUp({ email, password, name, redirectTo }: SignUpInput): Promise<SignUpResult> {
    const { data, error } = await this.client().auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: redirectTo },
    })

    if (error) throw translate(error)

    /*
     * Com confirmacao por e-mail ligada, um endereco ja cadastrado devolve um
     * usuario com `identities` vazio, e nao um erro — e proposital do Supabase,
     * para nao permitir descobrir quem tem conta. Repassamos esse
     * comportamento: quem chama responde "confira seu e-mail" nos dois casos.
     */
    return { needsEmailConfirmation: !data.session }
  }

  async signInWithPassword(email: string, password: string): Promise<void> {
    const { error } = await this.client().auth.signInWithPassword({ email, password })
    if (error) throw translate(error)
  }

  async signOut(): Promise<void> {
    await this.client().auth.signOut()
  }

  async sendPasswordReset(email: string, redirectTo: string): Promise<void> {
    const { error } = await this.client().auth.resetPasswordForEmail(email, { redirectTo })
    // Endereco desconhecido nao e erro aqui, e nao pode virar um: a diferenca
    // entre "enviado" e "nao existe" e uma lista de quem tem conta.
    if (error && error.status !== 400) throw translate(error)
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await this.client().auth.updateUser({ password })
    if (error) throw translate(error)
  }

  async exchangeCodeForSession(code: string): Promise<void> {
    const { error } = await this.client().auth.exchangeCodeForSession(code)
    if (error) throw new AuthenticationError('Este link expirou ou já foi usado.')
  }

  async oauthUrl(provider: OAuthProviderId, redirectTo: string): Promise<string> {
    const { data, error } = await this.client().auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    })
    if (error || !data.url) throw translate(error)
    return data.url
  }
}

/**
 * Erro do provedor para a taxonomia do dominio.
 *
 * O que **nao** pode acontecer aqui: repassar a mensagem crua numa falha de
 * login. "Invalid login credentials" e generico de proposito no Supabase, e
 * qualquer detalhamento nosso — "e-mail nao encontrado" — viraria uma forma de
 * descobrir quem tem conta.
 */
function translate(error: { message?: string; code?: string; status?: number } | null): Error {
  const code = error?.code
  const message = error?.message ?? ''

  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return new AuthenticationError('E-mail ou senha incorretos.')
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return new AuthenticationError(
      'Confirme seu e-mail antes de entrar. Procure a mensagem que enviamos.',
    )
  }
  if (code === 'weak_password' || /password should be at least/i.test(message)) {
    return new ValidationError('A senha não atende ao mínimo exigido.', {
      password: ['Escolha uma senha mais longa.'],
    })
  }
  if (code === 'over_email_send_rate_limit' || /rate limit/i.test(message)) {
    return new AuthenticationError(
      'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
    )
  }
  if (code === 'same_password') {
    return new ValidationError('A senha nova precisa ser diferente da atual.', {
      password: ['Escolha uma senha diferente da anterior.'],
    })
  }

  // Falha desconhecida: mensagem generica para o cliente, detalhe no log.
  console.error('[auth] falha nao mapeada do provedor', { code, status: error?.status, message })
  return new AuthenticationError('Não foi possível concluir. Tente de novo em instantes.')
}

/**
 * Quais provedores sociais estao ligados no projeto.
 *
 * Vem do proprio Supabase, e nao de variavel de ambiente, para que a tela nunca
 * ofereca um botao que leva a erro. O resultado fica em cache por alguns
 * minutos: e configuracao que muda uma vez por ano, e consultar a cada
 * renderizacao poria uma ida a Sao Paulo no caminho de abrir a tela de login.
 */
export class SupabaseOAuthAvailability implements OAuthAvailability {
  private static cache: { providers: OAuthProviderId[]; expiresAt: number } | null = null
  private static readonly TTL_MS = 5 * 60_000

  async enabledProviders(): Promise<OAuthProviderId[]> {
    const now = Date.now()
    const cached = SupabaseOAuthAvailability.cache
    if (cached && cached.expiresAt > now) return cached.providers

    let providers: OAuthProviderId[] = []
    try {
      const { url, publishableKey } = readConfig()
      const response = await fetch(`${url}/auth/v1/settings`, {
        headers: { apikey: publishableKey },
        signal: AbortSignal.timeout(3000),
      })
      if (response.ok) {
        const settings = (await response.json()) as { external?: Record<string, boolean> }
        providers = (['google', 'apple'] as const).filter(
          (provider) => settings.external?.[provider] === true,
        )
      }
    } catch {
      // Sem resposta, nenhum botao social. Falhar para o lado de nao oferecer e
      // o certo: a tela de entrar continua funcionando com e-mail e senha.
    }

    SupabaseOAuthAvailability.cache = {
      providers,
      expiresAt: now + SupabaseOAuthAvailability.TTL_MS,
    }
    return providers
  }
}
