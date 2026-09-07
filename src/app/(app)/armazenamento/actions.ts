'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  createStorageLocation,
  deleteStorageLocation,
  setAllocation,
  updateStorageLocation,
} from '@/server/application/storage'
import { formError, formErrorFrom } from '@/server/http/form-state'
import { currentViewer } from '@/server/http/viewer'
import type { AllocationState, LocationFormState } from './state'

/**
 * Criar, editar e excluir locais; guardar cópias num local.
 *
 * Camada: `app`. Finas de propósito — leem a sessão, chamam **um** caso de uso e
 * traduzem o resultado. A regra, a transação e o lock estão no caso de uso.
 *
 * O `user_id` vem da sessão e nunca do formulário (`architecture.md` 3.1).
 */

const SESSION_EXPIRED = 'Sua sessão expirou. Entre de novo.'

export async function createLocationAction(
  _previous: LocationFormState,
  data: FormData,
): Promise<LocationFormState> {
  const viewer = await currentViewer()
  if (!viewer) return formError(SESSION_EXPIRED)

  let id: string
  try {
    const created = await createStorageLocation(viewer, await readInput(data))
    id = created.id
  } catch (error) {
    return formErrorFrom(error)
  }

  revalidatePath('/armazenamento')
  // Fora do try: `redirect` sinaliza por exceção, e um catch a engoliria.
  redirect(`/armazenamento/${id}`)
}

export async function updateLocationAction(
  _previous: LocationFormState,
  data: FormData,
): Promise<LocationFormState> {
  const viewer = await currentViewer()
  if (!viewer) return formError(SESSION_EXPIRED)

  const id = String(data.get('id') ?? '')
  if (!/^\d+$/.test(id)) return formError('Local inválido.')

  try {
    await updateStorageLocation(viewer, BigInt(id), await readInput(data))
  } catch (error) {
    return formErrorFrom(error)
  }

  revalidatePath('/armazenamento')
  revalidatePath(`/armazenamento/${id}`)
  redirect(`/armazenamento/${id}`)
}

export async function deleteLocationAction(
  _previous: LocationFormState,
  data: FormData,
): Promise<LocationFormState> {
  const viewer = await currentViewer()
  if (!viewer) return formError(SESSION_EXPIRED)

  const id = String(data.get('id') ?? '')
  if (!/^\d+$/.test(id)) return formError('Local inválido.')

  try {
    await deleteStorageLocation(viewer, BigInt(id))
  } catch (error) {
    return formErrorFrom(error)
  }

  // A coleção não muda ao excluir um local, mas as telas que mostram onde as
  // cartas estão, sim.
  revalidatePath('/armazenamento')
  revalidatePath('/colecao')
  redirect('/armazenamento')
}

export async function setAllocationAction(
  _previous: AllocationState,
  data: FormData,
): Promise<AllocationState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: SESSION_EXPIRED }

  const variantId = String(data.get('variantId') ?? '')
  const storageLocationId = String(data.get('storageLocationId') ?? '')
  const locationName = String(data.get('locationName') ?? '')
  const quantity = Number(data.get('quantity'))

  if (
    !/^\d+$/.test(variantId) ||
    !/^\d+$/.test(storageLocationId) ||
    !Number.isInteger(quantity) ||
    quantity < 0
  ) {
    return { status: 'error', message: 'Quantidade inválida.' }
  }

  try {
    const result = await setAllocation(
      viewer,
      BigInt(variantId),
      BigInt(storageLocationId),
      quantity,
    )

    revalidatePath('/armazenamento')
    revalidatePath(`/armazenamento/${storageLocationId}`)
    revalidatePath(`/armazenamento/${storageLocationId}/cartas`)
    revalidatePath(`/catalogo/carta/${variantId}`)

    return {
      status: 'saved',
      quantity: result.quantity,
      storageLocationId,
      locationName,
    }
  } catch (error) {
    return { status: 'error', message: formErrorFrom(error).message }
  }
}

/**
 * O formulário para o formato do caso de uso.
 *
 * O arquivo vira bytes aqui, e não no caso de uso: `File` é um tipo do
 * navegador que chega até a Server Action, e deixá-lo atravessar mais uma
 * camada espalharia uma dependência de plataforma por dentro da aplicação.
 */
async function readInput(data: FormData) {
  const file = data.get('image')
  const image =
    file instanceof File && file.size > 0
      ? new Uint8Array(await file.arrayBuffer())
      : undefined

  return {
    name: String(data.get('name') ?? ''),
    description: String(data.get('description') ?? '') || null,
    type: String(data.get('type') ?? ''),
    purpose: String(data.get('purpose') ?? '') || null,
    image,
    removeImage: data.get('removeImage') === 'on',
  }
}
