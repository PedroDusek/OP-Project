'use server'

import { revalidatePath } from 'next/cache'
import { recordConflictAnswer } from '@/server/application/prices/liga-conflicts'
import { isAppError } from '@/server/domain/errors'
import { NENHUM_PRODUTO, type ConflictAnswerState } from './state'

/**
 * Grava, no arquivo de vínculos manuais, o produto certo de um conflito.
 *
 * Camada: `app`. Fina de propósito — lê o formulário, chama **um** caso de uso e
 * traduz o resultado. A recusa fora de desenvolvimento e a conferência contra o
 * levantamento estão no caso de uso. Sem sessão, como as outras telas de
 * mapeamento: não há dado de pessoa, e o que ela grava só chega a algum lugar
 * passando por PR.
 */
export async function recordConflictAnswerAction(
  _previous: ConflictAnswerState,
  data: FormData,
): Promise<ConflictAnswerState> {
  const sourceId = String(data.get('arte') ?? '').trim()
  const escolha = String(data.get('produto') ?? '').trim()
  if (sourceId === '') return { status: 'error', message: 'Arte não informada.' }
  if (escolha === '') return { status: 'error', message: 'Escolha o produto certo, ou "nenhum destes".' }

  try {
    const link = recordConflictAnswer(sourceId, escolha === NENHUM_PRODUTO ? null : escolha)
    revalidatePath('/dev/liga/conflitos')
    return { status: 'saved', produto: link.produto }
  } catch (error) {
    if (isAppError(error)) return { status: 'error', message: error.message }
    throw error
  }
}
