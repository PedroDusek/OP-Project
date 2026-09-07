import { consumeRateLimit, AUTH_ATTEMPT_LIMIT, EMAIL_SEND_LIMIT } from '@/server/http/rate-limit'
import { parseOrThrow } from '@/server/http/validation'
import {
  newPasswordSchema,
  passwordResetSchema,
  signInSchema,
  signUpSchema,
} from '@/server/http/schemas/auth'
import type { CookieStore, OAuthProviderId } from '@/server/http/auth-provider'
import { activeAuthProvider } from './index'

/**
 * Entrar, cadastrar, sair e redefinir senha.
 *
 * Camada: application. Sao casos de uso porque cada um combina validacao,
 * limite de tentativa e a chamada ao provedor — e porque a acao do formulario
 * precisa ser fina, sem regra propria (`architecture.md` 3.1).
 *
 * Nenhum deles guarda senha, e nenhum deles compara senha: isso e do provedor
 * (decisao 025). O que mora aqui e o que **nos** precisamos garantir.
 */

export interface Deps {
  cookies: CookieStore
  /** Base da aplicacao, para montar o retorno dos links de e-mail. */
  appUrl: string
}

/**
 * Caminho interno, ou o inicio.
 *
 * `next` vem da query string, e portanto de fora. Sem esta checagem,
 * `/entrar?next=https://outrolugar` faria a **nossa** tela mandar a pessoa para
 * fora logo depois de ela digitar a senha — o formato classico de phishing por
 * redirecionamento aberto.
 *
 * Mora no caso de uso, e nao so na acao do formulario, porque e regra de
 * seguranca: qualquer caminho novo que chame `startOAuth` ganha a checagem sem
 * precisar lembrar dela.
 */
function internalPath(next: string | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/inicio'
  return next
}

const callbackUrl = (appUrl: string, next?: string) => {
  const url = new URL('/auth/callback', appUrl)
  url.searchParams.set('next', internalPath(next))
  return url.toString()
}

export async function signIn(input: unknown, { cookies }: Deps): Promise<void> {
  const { email, password } = parseOrThrow(signInSchema, input)

  /*
   * A cota e por endereco, e nao por IP.
   *
   * Por endereco e o que contem a tentativa de adivinhar a senha de **uma**
   * conta, que e o ataque que importa aqui. Por IP seria facil de contornar e
   * bloquearia gente inocente atras do mesmo NAT.
   *
   * Consumir antes de chamar o provedor e proposital: contar so as falhas
   * deixaria a cota infinita para quem acerta, e a cota existe justamente para
   * quem esta chutando.
   */
  consumeRateLimit(`auth:signin:${email}`, AUTH_ATTEMPT_LIMIT)

  await activeAuthProvider(cookies).signInWithPassword(email, password)
}

export interface SignUpOutcome {
  needsEmailConfirmation: boolean
  email: string
}

export async function signUp(input: unknown, { cookies, appUrl }: Deps): Promise<SignUpOutcome> {
  const { name, email, password } = parseOrThrow(signUpSchema, input)

  consumeRateLimit(`auth:signup:${email}`, EMAIL_SEND_LIMIT)

  const result = await activeAuthProvider(cookies).signUp({
    name,
    email,
    password,
    redirectTo: callbackUrl(appUrl, '/inicio'),
  })

  return { ...result, email }
}

export async function signOut({ cookies }: Deps): Promise<void> {
  await activeAuthProvider(cookies).signOut()
}

/**
 * Pede o e-mail de redefinicao.
 *
 * Devolve `void` de proposito, e a tela mostra a mesma confirmacao sempre:
 * responder diferente para endereco desconhecido transformaria esta tela numa
 * consulta de "quem tem conta aqui".
 */
export async function requestPasswordReset(input: unknown, { cookies, appUrl }: Deps): Promise<void> {
  const { email } = parseOrThrow(passwordResetSchema, input)

  consumeRateLimit(`auth:reset:${email}`, EMAIL_SEND_LIMIT)

  await activeAuthProvider(cookies).sendPasswordReset(
    email,
    callbackUrl(appUrl, '/nova-senha'),
  )
}

/** Define a senha nova. Exige a sessao curta que o link de redefinicao criou. */
export async function setNewPassword(input: unknown, { cookies }: Deps): Promise<void> {
  const { password } = parseOrThrow(newPasswordSchema, input)
  await activeAuthProvider(cookies).updatePassword(password)
}

export async function completeOAuth(code: string, { cookies }: Deps): Promise<void> {
  await activeAuthProvider(cookies).exchangeCodeForSession(code)
}

export async function startOAuth(
  provider: OAuthProviderId,
  { cookies, appUrl }: Deps,
  next = '/inicio',
): Promise<string> {
  return activeAuthProvider(cookies).oauthUrl(provider, callbackUrl(appUrl, next))
}
