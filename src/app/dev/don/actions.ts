'use server'

import { revalidatePath } from 'next/cache'
import { recordDonSets } from '@/server/application/catalog'
import { isAppError } from '@/server/domain/errors'
import type { DonSetsState } from './state'

/**
 * Grava em que coleções uma arte de DON!! saiu.
 *
 * Camada: `app`. Fina de propósito — lê o formulário, chama **um** caso de uso
 * e traduz o resultado. A recusa fora de desenvolvimento e a conferência dos
 * códigos estão no caso de uso.
 *
 * Sem sessão pelo mesmo motivo da conferência da Liga: não há dado de pessoa, e
 * o que ela grava só chega a algum lugar passando por PR.
 */
export async function recordDonSetsAction(
  _previous: DonSetsState,
  data: FormData,
): Promise<DonSetsState> {
  const arte = String(data.get('arte') ?? '').trim()
  if (arte === '') return { status: 'error', message: 'Arte não informada.' }

  // Vários `set` no mesmo formulário: uma arte pode ter saído em mais de uma
  // coleção, como qualquer reimpressão.
  const sets = data.getAll('set').map((value) => String(value).trim()).filter((value) => value !== '')

  try {
    await recordDonSets(arte, sets)
    revalidatePath('/dev/don')
    return { status: 'saved', sets }
  } catch (error) {
    if (isAppError(error)) return { status: 'error', message: error.message }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Não foi possível gravar.',
    }
  }
}
