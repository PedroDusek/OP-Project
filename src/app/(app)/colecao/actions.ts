'use server'

import { revalidatePath } from 'next/cache'
import { setCollectionQuantity, QUANTITY_BELOW_ALLOCATED } from '@/server/application/collection'
import { ConflictError, isAppError } from '@/server/domain/errors'
import { formErrorFrom } from '@/server/http/form-state'
import { currentViewer } from '@/server/http/viewer'
import type { AllocationSnapshot } from '@/server/application/collection'
import type { QuantityState } from './state'

/**
 * Definir quantas copias a pessoa possui.
 *
 * Camada: `app`. Fina de proposito — le a sessao, chama **um** caso de uso e
 * traduz o resultado. A regra, a transacao e o lock estao no caso de uso.
 *
 * O `user_id` vem da sessao e nunca do formulario (`architecture.md` 3.1).
 */
export async function setQuantityAction(
  _previous: QuantityState,
  data: FormData,
): Promise<QuantityState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: 'Sua sessão expirou. Entre de novo.' }

  const variantId = String(data.get('variantId') ?? '')
  const quantity = Number(data.get('quantity'))

  if (!/^\d+$/.test(variantId) || !Number.isInteger(quantity) || quantity < 0) {
    return { status: 'error', message: 'Quantidade inválida.' }
  }

  try {
    const result = await setCollectionQuantity(viewer, BigInt(variantId), quantity)

    // A colecao, os playsets e os numeros da Home mudam juntos.
    revalidatePath('/colecao')
    revalidatePath('/colecao/playsets')
    revalidatePath('/inicio')
    revalidatePath(`/catalogo/carta/${variantId}`)

    return { status: 'saved', quantity: result.quantity, removed: result.removed }
  } catch (error) {
    if (isAppError(error) && error instanceof ConflictError && error.code === QUANTITY_BELOW_ALLOCATED) {
      const details = error.details as {
        currentQuantity: number
        requestedQuantity: number
        allocations: AllocationSnapshot[]
      }
      return {
        status: 'conflict',
        message: error.message,
        currentQuantity: details.currentQuantity,
        requestedQuantity: details.requestedQuantity,
        allocations: details.allocations,
      }
    }

    return { status: 'error', message: formErrorFrom(error).message }
  }
}
