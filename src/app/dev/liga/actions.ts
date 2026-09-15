'use server'

import { revalidatePath } from 'next/cache'
import { clearLigaCard, confirmReprint, recordLigaCard } from '@/server/application/catalog'
import { isAppError } from '@/server/domain/errors'
import type { LigaCardIntent, LigaCardState } from './state'

/** As duas telas leem a mesma tabela: gravar numa desatualiza a outra. */
function revalidar(): void {
  revalidatePath('/dev/liga')
  revalidatePath('/dev/liga/revisar')
}

/**
 * Grava, para uma arte, o que a pessoa conferiu na Liga.
 *
 * Camada: `app`. Fina de propósito — lê o formulário, chama **um** caso de uso e
 * traduz o resultado. A recusa fora de desenvolvimento e a conferência do
 * endereço estão no caso de uso.
 *
 * Sem sessão pelo mesmo motivo da tela de paralelas: não há dado de pessoa, e o
 * que ela grava só chega a algum lugar passando por PR.
 */
export async function recordLigaCardAction(
  _previous: LigaCardState,
  data: FormData,
): Promise<LigaCardState> {
  const sourceId = String(data.get('arte') ?? '').trim()
  if (sourceId === '') return { status: 'error', message: 'Arte não informada.' }

  const intent = String(data.get('intencao') ?? 'gravar') as LigaCardIntent

  try {
    if (intent === 'limpar') {
      clearLigaCard(sourceId)
      revalidar()
      return { status: 'cleared' }
    }

    if (intent === 'confirmar-reprint') {
      confirmReprint(sourceId)
      revalidar()
      return { status: 'confirmed' }
    }

    const url = intent === 'sem-pagina' ? null : String(data.get('url') ?? '')
    if (url !== null && url.trim() === '') {
      return { status: 'error', message: 'Cole o endereço da carta na Liga.' }
    }

    const entry = await recordLigaCard(sourceId, url)
    revalidar()
    return { status: 'saved', url: entry.url }
  } catch (error) {
    if (isAppError(error)) return { status: 'error', message: error.message }
    throw error
  }
}
