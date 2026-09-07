/**
 * Contrato do provedor de credencial.
 *
 * Camada: http. Sem I/O e sem persistencia: apenas o formato das operacoes que
 * criam e destroem sessao.
 *
 * Existe pelo mesmo motivo que `SessionProvider` (decisao 025): o resto do
 * sistema nao fala com o Supabase, fala com esta interface. Trocar de provedor
 * mexe numa implementacao, e os testes rodam sem rede com um provedor falso.
 *
 * ## Este escreve cookie; o `SessionProvider` nao
 *
 * `architecture.md` 3.4 diz que o provedor usado pelas rotas so le cookie, e
 * que renovar e trabalho do middleware. Isso continua valendo e nao conflita
 * com o que esta aqui: sao operacoes diferentes.
 *
 *   - **Ler** a sessao acontece em toda requisicao. Se o caminho de leitura
 *     tambem renovasse, middleware e rota disputariam o mesmo refresh token, e
 *     quem perdesse a corrida derrubaria a sessao.
 *   - **Criar** e **destruir** a sessao acontece em uma acao explicita, uma vez.
 *     Nao ha corrida: ninguem entra e sai ao mesmo tempo.
 *
 * Por isso o provedor de credencial recebe um `CookieStore` capaz de escrever, e
 * o de sessao nao.
 */

/** O que a acao entrega ao provedor para ele guardar a sessao. */
export interface CookieStore {
  getAll(): { name: string; value: string }[]
  set(name: string, value: string, options: CookieSetOptions): void
}

export interface CookieSetOptions {
  path?: string
  domain?: string
  maxAge?: number
  expires?: Date
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'lax' | 'strict' | 'none' | boolean
}

export type OAuthProviderId = 'google' | 'apple'

export interface SignUpInput {
  email: string
  password: string
  name: string
  /** Para onde o link do e-mail de confirmacao volta. */
  redirectTo: string
}

export interface SignUpResult {
  /**
   * `true` quando o provedor exige confirmacao por e-mail antes de a sessao
   * existir. Nesse caso **nao ha sessao ainda**, e a tela precisa dizer isso em
   * vez de mandar a pessoa para dentro do app.
   */
  needsEmailConfirmation: boolean
}

export interface AuthProvider {
  readonly name: string

  signUp(input: SignUpInput): Promise<SignUpResult>

  /** Lanca `AuthenticationError` com mensagem generica quando falha. */
  signInWithPassword(email: string, password: string): Promise<void>

  signOut(): Promise<void>

  /**
   * Envia o e-mail de redefinicao. **Nao** revela se o endereco existe: quem
   * chama responde a mesma coisa nos dois casos.
   */
  sendPasswordReset(email: string, redirectTo: string): Promise<void>

  /** Troca a senha de quem ja esta autenticado pelo link de redefinicao. */
  updatePassword(password: string): Promise<void>

  /** Troca o codigo do link de e-mail ou do OAuth por uma sessao. */
  exchangeCodeForSession(code: string): Promise<void>

  /** URL para onde mandar o navegador para comecar o fluxo do provedor. */
  oauthUrl(provider: OAuthProviderId, redirectTo: string): Promise<string>
}

/**
 * Quais provedores sociais estao ligados **de verdade**.
 *
 * Vem do provedor, e nao de uma variavel de ambiente, para que a tela nao possa
 * discordar da realidade: um botao "Continuar com o Google" que leva a um erro
 * do Supabase e pior que botao nenhum.
 */
export interface OAuthAvailability {
  enabledProviders(): Promise<OAuthProviderId[]>
}
