'use server'

import { revalidatePath } from 'next/cache'
import { recordCardMapping, type MappingAnswer } from '@/server/application/prices/parallel-mapping'
import { isAppError } from '@/server/domain/errors'
import { ART_FIELD_PREFIX, NO_PRODUCT, type MappingState } from './state'

/**
 * Grava as respostas de uma carta no arquivo de vínculos manuais.
 *
 * Camada: `app`. Fina de propósito — lê o formulário, chama **um** caso de uso e
 * traduz o resultado.
 *
 * ## Sem sessão, de propósito
 *
 * Não há dado de pessoa aqui: a ação grava um arquivo do repositório, e só existe
 * na máquina de quem desenvolve. A recusa fora de desenvolvimento está no caso de
 * uso, que é chamado mesmo quando a ação é invocada direto, sem a página — e o
 * que ela grava só chega a algum lugar passando por PR.
 *
 * ## O formulário não é confiável
 *
 * Os campos dizem qual arte recebe qual produto, e o caso de uso confere cada par
 * contra o levantamento. Aqui só se traduz o formato; nenhuma regra mora na ação.
 */
export async function recordCardMappingAction(
  _previous: MappingState,
  data: FormData,
): Promise<MappingState> {
  const cardCode = String(data.get('carta') ?? '').trim()
  if (cardCode === '') return { status: 'error', message: 'Carta não informada.' }

  const answers: MappingAnswer[] = []
  for (const [campo, valor] of data.entries()) {
    if (!campo.startsWith(ART_FIELD_PREFIX) || typeof valor !== 'string' || valor === '') continue
    answers.push({
      sourceId: campo.slice(ART_FIELD_PREFIX.length),
      productId: valor === NO_PRODUCT ? null : valor,
    })
  }

  try {
    const { recorded } = recordCardMapping(cardCode, answers)
    revalidatePath('/dev/paralelas')
    return { status: 'saved', recorded }
  } catch (error) {
    if (isAppError(error)) return { status: 'error', message: error.message }
    throw error
  }
}
