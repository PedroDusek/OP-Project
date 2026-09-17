'use server'

import { revalidatePath } from 'next/cache'
import { blockMember, reportMember, unblockMember } from '@/server/application/social'
import { isAppError } from '@/server/domain/errors'
import { currentViewer } from '@/server/http/viewer'
import type { NetworkActionState } from './state'

/**
 * Os gestos da rede sobre outra pessoa (regra 6.1.4).
 *
 * Camada: `app`. Finas: leem a sessão, chamam **um** caso de uso e traduzem o
 * resultado. Quem bloqueia ou denuncia é quem está na sessão; o formulário só
 * diz **quem** é o alvo, pelo nome de usuário, que é público.
 */

const SESSAO_EXPIRADA = 'Sua sessão expirou. Entre de novo.'

function alvo(data: FormData): string {
  return String(data.get('username') ?? '').trim()
}

function revalidar(username: string) {
  revalidatePath('/social')
  revalidatePath(`/social/${username}`)
  revalidatePath('/conta')
}

async function executar(
  gesto: () => Promise<void>,
  username: string,
  sucesso: string,
): Promise<NetworkActionState> {
  try {
    await gesto()
    revalidar(username)
    return { status: 'done', message: sucesso }
  } catch (error) {
    if (isAppError(error)) return { status: 'error', message: error.message }
    throw error
  }
}

export async function blockMemberAction(_previous: NetworkActionState, data: FormData): Promise<NetworkActionState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: SESSAO_EXPIRADA }
  const username = alvo(data)
  return executar(() => blockMember(viewer, username), username, `@${username} foi bloqueado.`)
}

export async function unblockMemberAction(_previous: NetworkActionState, data: FormData): Promise<NetworkActionState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: SESSAO_EXPIRADA }
  const username = alvo(data)
  return executar(() => unblockMember(viewer, username), username, `@${username} foi desbloqueado.`)
}

export async function reportMemberAction(_previous: NetworkActionState, data: FormData): Promise<NetworkActionState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: SESSAO_EXPIRADA }
  const username = alvo(data)
  const motivo = String(data.get('motivo') ?? '')
  return executar(
    () => reportMember(viewer, username, motivo),
    username,
    'Denúncia enviada. Obrigado por avisar.',
  )
}
