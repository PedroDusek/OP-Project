'use server'

import { revalidatePath } from 'next/cache'
import { setUsername } from '@/server/application/social'
import { isAppError } from '@/server/domain/errors'
import { formErrorFrom } from '@/server/http/form-state'
import { currentViewer } from '@/server/http/viewer'
import type { UsernameState } from './state'

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
