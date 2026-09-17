'use server'

import { redirect } from 'next/navigation'
import {
  requestPasswordReset,
  setNewPassword,
  signIn,
  signOut,
  signUp,
  startOAuth,
} from '@/server/application/auth/credentials'
import { cancelAccountDeletion } from '@/server/application/account'
import { appUrl } from '@/server/http/app-url'
import { formErrorFrom } from '@/server/http/form-state'
import { requestCookies } from '@/server/http/next-cookies'
import type { OAuthProviderId } from '@/server/http/auth-provider'
import type { AuthFormState } from './state'

/**
 * As acoes dos formularios de conta.
 *
 * Camada: `app`. Sao finas de proposito — leem o `FormData`, chamam **um** caso
 * de uso e traduzem o resultado (`architecture.md` 3.1). Nenhuma regra mora
 * aqui.
 *
 * Server Actions, e nao um cliente Supabase no navegador, por duas razoes. A
 * senha e validada no servidor, que e onde toda regra deste projeto vive; e o
 * pacote enviado ao navegador nao carrega SDK nem logica de autenticacao.
 */

/** `FormData` traz "on" para caixa marcada e nada para desmarcada. */
const checked = (data: FormData, name: string) => data.get(name) !== null

/** O token do Turnstile, que o componente `Captcha` poe no formulario (decisao 088). */
const captcha = (data: FormData) => String(data.get('captchaToken') ?? '')

export async function signInAction(
  _previous: AuthFormState,
  data: FormData,
): Promise<AuthFormState> {
  const remember = checked(data, 'remember')

  let deletionCancelled = false
  try {
    ;({ deletionCancelled } = await signIn(
      {
        email: data.get('email'),
        password: data.get('password'),
        remember,
        captchaToken: captcha(data),
      },
      { cookies: await requestCookies({ remember }), appUrl: appUrl(), cancelDeletion: cancelAccountDeletion },
    ))
  } catch (error) {
    return formErrorFrom(error)
  }

  // Fora do try: `redirect` funciona lancando, e captura-lo aqui viraria um
  // "erro interno" logo depois de um login que deu certo.
  //
  // Quem tinha pedido para excluir a conta vai para o inicio, que diz que o
  // pedido foi cancelado (decisao 091), e nao para onde ia.
  redirect(deletionCancelled ? '/inicio?exclusao=cancelada' : safeNext(data.get('next')))
}

export async function signUpAction(
  _previous: AuthFormState,
  data: FormData,
): Promise<AuthFormState> {
  try {
    const outcome = await signUp(
      {
        name: data.get('name'),
        email: data.get('email'),
        password: data.get('password'),
        passwordConfirmation: data.get('passwordConfirmation'),
        acceptedTerms: checked(data, 'acceptedTerms'),
        captchaToken: captcha(data),
      },
      { cookies: await requestCookies(), appUrl: appUrl() },
    )

    /*
     * Com confirmacao por e-mail ligada no provedor, nao existe sessao ainda.
     * Mandar a pessoa para dentro do app aqui daria uma tela vazia e um logout
     * inexplicavel no primeiro clique.
     */
    if (outcome.needsEmailConfirmation) {
      return { status: 'sent', email: outcome.email }
    }
  } catch (error) {
    return formErrorFrom(error)
  }

  redirect('/inicio')
}

export async function passwordResetAction(
  _previous: AuthFormState,
  data: FormData,
): Promise<AuthFormState> {
  const email = String(data.get('email') ?? '')
    .trim()
    .toLowerCase()

  try {
    await requestPasswordReset(
      { email, captchaToken: captcha(data) },
      { cookies: await requestCookies(), appUrl: appUrl() },
    )
  } catch (error) {
    return formErrorFrom(error)
  }

  // Mesma resposta para endereco existente e inexistente: responder diferente
  // transformaria esta tela numa consulta de quem tem conta.
  return { status: 'sent', email }
}

export async function newPasswordAction(
  _previous: AuthFormState,
  data: FormData,
): Promise<AuthFormState> {
  try {
    await setNewPassword(
      {
        password: data.get('password'),
        passwordConfirmation: data.get('passwordConfirmation'),
      },
      { cookies: await requestCookies(), appUrl: appUrl() },
    )
  } catch (error) {
    return formErrorFrom(error)
  }

  redirect('/inicio')
}

export async function signOutAction(): Promise<void> {
  await signOut({ cookies: await requestCookies(), appUrl: appUrl() })
  redirect('/')
}

export async function startOAuthAction(provider: OAuthProviderId, next?: string): Promise<void> {
  // `next` nao e higienizado aqui: `startOAuth` ja o faz, e e la que a regra
  // pertence. Repetir daria dois lugares para mudar quando ela mudar.
  const url = await startOAuth(provider, { cookies: await requestCookies(), appUrl: appUrl() }, next)
  redirect(url)
}

/**
 * Para onde voltar depois de entrar.
 *
 * So aceita caminho interno. Sem isto, `/entrar?next=https://outrolugar` faria
 * a nossa tela de login mandar a pessoa para fora logo depois de ela digitar a
 * senha — que e o formato classico de phishing por redirecionamento aberto.
 */
function safeNext(value: unknown): string {
  const next = typeof value === 'string' ? value : ''
  if (!next.startsWith('/') || next.startsWith('//')) return '/inicio'
  return next
}
