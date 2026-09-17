'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sendMessage, startConversation } from '@/server/application/social'
import { isAppError } from '@/server/domain/errors'
import { currentViewer } from '@/server/http/viewer'
import type { SendMessageState, StartConversationState } from './state'

/**
 * As ações das conversas (decisão 081).
 *
 * Camada: `app`. Finas: leem a sessão, chamam **um** caso de uso e traduzem o
 * resultado. Quem escreve é quem está na sessão; o formulário diz só a conversa
 * e o texto, e o caso de uso confere que quem escreve participa dela.
 */

const SESSAO_EXPIRADA = 'Sua sessão expirou. Entre de novo.'

/** Abre a conversa com alguém da rede e leva para ela. */
export async function startConversationAction(
  _previous: StartConversationState,
  data: FormData,
): Promise<StartConversationState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: SESSAO_EXPIRADA }

  let conversationId: bigint
  try {
    conversationId = await startConversation(viewer, String(data.get('username') ?? '').trim())
  } catch (error) {
    if (isAppError(error)) return { status: 'error', message: error.message }
    throw error
  }
  // Fora do try: o redirect do Next funciona lancando, e o catch o engoliria.
  redirect(`/conversas/${conversationId}`)
}

export async function sendMessageAction(_previous: SendMessageState, data: FormData): Promise<SendMessageState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: SESSAO_EXPIRADA }

  const id = String(data.get('conversa') ?? '')
  if (!/^\d+$/.test(id)) return { status: 'error', message: 'Conversa inválida.' }

  try {
    await sendMessage(viewer, BigInt(id), String(data.get('mensagem') ?? ''))
    revalidatePath(`/conversas/${id}`)
    revalidatePath('/conversas')
    return { status: 'sent', at: Date.now() }
  } catch (error) {
    if (isAppError(error)) return { status: 'error', message: error.message }
    throw error
  }
}
