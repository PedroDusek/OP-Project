'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requestAccountDeletion, sendFeedback } from '@/server/application/account'
import { signOut } from '@/server/application/auth/credentials'
import { setUsername } from '@/server/application/social'
import { appUrl } from '@/server/http/app-url'
import { requestCookies } from '@/server/http/next-cookies'
import { isAppError } from '@/server/domain/errors'
import { formErrorFrom } from '@/server/http/form-state'
import { currentViewer } from '@/server/http/viewer'
import type { DeletionState, FeedbackState, UsernameState } from './state'

/**
 * Escolher ou trocar o nome de usuario.
 *
 * Camada: `app`. Fina de proposito — le a sessao, chama **um** caso de uso e
 * traduz o resultado. A validacao, a unicidade e a regra da semana estao no
 * caso de uso e no banco.
 */
export async function setUsernameAction(
  _previous: UsernameState,
  data: FormData,
): Promise<UsernameState> {
  const viewer = await currentViewer()
  if (!viewer) {
    return { status: 'error', message: 'Sua sessão expirou. Entre de novo.', fields: {} }
  }

  try {
    const { username } = await setUsername(viewer, String(data.get('username') ?? ''))
    revalidatePath('/conta')
    return { status: 'saved', username }
  } catch (error) {
    if (isAppError(error)) return formErrorFrom(error)
    throw error
  }
}

/**
 * Pedir a exclusao da conta (decisao 091).
 *
 * Pede, e encerra a sessao em seguida: a partir do pedido a conta nao autentica
 * mais, e deixar a sessao aberta mostraria telas que respondem "sessao expirada".
 * Encerrar no provedor derruba tambem as sessoes dos outros aparelhos.
 */
export async function requestAccountDeletionAction(
  _previous: DeletionState,
  data: FormData,
): Promise<DeletionState> {
  const viewer = await currentViewer()
  if (!viewer) {
    return { status: 'error', message: 'Sua sessão expirou. Entre de novo.', fields: {} }
  }

  try {
    await requestAccountDeletion(viewer, String(data.get('confirmacao') ?? ''))
  } catch (error) {
    if (isAppError(error)) return formErrorFrom(error)
    throw error
  }

  await signOut({ cookies: await requestCookies(), appUrl: appUrl() })
  redirect('/exclusao-solicitada')
}

/** Mandar feedback ao suporte (decisão 096). */
export async function sendFeedbackAction(_previous: FeedbackState, data: FormData): Promise<FeedbackState> {
  const viewer = await currentViewer()
  if (!viewer) {
    return { status: 'error', message: 'Sua sessão expirou. Entre de novo.', fields: {} }
  }

  try {
    await sendFeedback(viewer, String(data.get('mensagem') ?? ''))
    return { status: 'sent' }
  } catch (error) {
    if (isAppError(error)) return formErrorFrom(error)
    throw error
  }
}
