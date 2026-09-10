'use server'

import { revalidatePath } from 'next/cache'
import { setCollectionQuantity, QUANTITY_BELOW_ALLOCATED } from '@/server/application/collection'
import { bulkAddWants, setWantQuantity } from '@/server/application/wants'
import type { BulkWantEntry } from '@/server/application/wants'
import { ConflictError, isAppError } from '@/server/domain/errors'
import { formErrorFrom } from '@/server/http/form-state'
import { currentViewer } from '@/server/http/viewer'
import type { AllocationSnapshot, Removal } from '@/server/application/collection'
import type { BulkWantState, QuantityState, WantState } from './state'

/**
 * Definir quantas copias a pessoa possui.
 *
 * Camada: `app`. Fina de proposito — le a sessao, chama **um** caso de uso e
 * traduz o resultado. A regra, a transacao e o lock estao no caso de uso.
 *
 * O `user_id` vem da sessao e nunca do formulario (`architecture.md` 3.1).
 *
 * Quando a reducao exige resolucao (decisao 007), a escolha da pessoa chega em
 * campos `remocao` e vai junto na **mesma** chamada: desalocar e reduzir em duas
 * idas deixaria uma janela com alocacao orfa, e um erro no meio pararia ali.
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

  const removals = readRemovals(data)
  if (removals === null) return { status: 'error', message: 'Retirada inválida.' }

  try {
    const result = await setCollectionQuantity(viewer, BigInt(variantId), quantity, removals)

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

/**
 * Definir quantas copias a pessoa quer.
 *
 * Camada: `app`. Le a sessao, chama **um** caso de uso e traduz o resultado.
 * O `user_id` vem da sessao e nunca do formulario (`architecture.md` 3.1).
 *
 * Querer zero e sair da lista: o banco exige `quantity > 0`, entao nao existe
 * uma segunda acao capaz de divergir desta.
 */
export async function setWantAction(
  _previous: WantState,
  data: FormData,
): Promise<WantState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: 'Sua sessão expirou. Entre de novo.' }

  const variantId = String(data.get('variantId') ?? '')
  const quantity = Number(data.get('quantity'))

  if (!/^\d+$/.test(variantId) || !Number.isInteger(quantity) || quantity < 0) {
    return { status: 'error', message: 'Quantidade inválida.' }
  }

  try {
    const result = await setWantQuantity(viewer, BigInt(variantId), quantity)

    revalidatePath('/colecao')
    revalidatePath('/quero')
    revalidatePath(`/catalogo/carta/${variantId}`)

    return { status: 'saved', quantity: result.quantity, removed: result.removed }
  } catch (error) {
    return { status: 'error', message: formErrorFrom(error).message }
  }
}

/**
 * As retiradas escolhidas, no formato `<idDoLocal>:<quantidade>`.
 *
 * Um campo repetido por local, e nao um JSON num campo so: o formulario ja sabe
 * mandar valores repetidos, e um JSON exigiria confiar na forma de um texto
 * vindo do cliente antes de conseguir olhar para ele.
 *
 * Devolve `null` quando alguma entrada nao tem o formato esperado. A validacao
 * de verdade — se a retirada existe, se cabe, se fecha a conta — e do dominio;
 * aqui so se recusa o que nem chega a ser um par de numeros.
 */
function readRemovals(data: FormData): Removal[] | null {
  const removals: Removal[] = []

  for (const entry of data.getAll('remocao')) {
    const match = /^(\d+):(\d+)$/.exec(String(entry))
    if (!match) return null
    removals.push({ storageLocationId: match[1], quantity: Number(match[2]) })
  }

  return removals
}

/**
 * Acrescentar uma leva de cartas a want list.
 *
 * Camada: `app`. Le a sessao, chama **um** caso de uso e traduz o resultado. O
 * `user_id` vem da sessao e nunca do formulario (`architecture.md` 3.1).
 *
 * As escolhas chegam como campos `carta` repetidos, no formato
 * `<variantId>:<copias>` — o mesmo arranjo da leva de armazenamento, e pelo
 * mesmo motivo: um formulario nativo manda repetidos sem depender de JavaScript
 * ter subido.
 */
export async function bulkWantAction(
  _previous: BulkWantState,
  data: FormData,
): Promise<BulkWantState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: 'Sua sessão expirou. Entre de novo.' }

  const entries: BulkWantEntry[] = []
  for (const raw of data.getAll('carta')) {
    const match = /^(\d+):(\d+)$/.exec(String(raw))
    if (!match) return { status: 'error', message: 'Escolha invalida.' }
    entries.push({ cardVariantId: BigInt(match[1]), copies: Number(match[2]) })
  }

  try {
    const result = await bulkAddWants(viewer, entries)

    // A leva mexe na lista e no resumo dela, nos dois lugares que a mostram.
    revalidatePath('/quero')
    revalidatePath('/conta')

    return { status: 'added', cards: result.variants, copies: result.copies }
  } catch (error) {
    if (isAppError(error)) return { status: 'error', message: error.message }
    throw error
  }
}
