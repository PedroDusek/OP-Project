import type { PrismaClient } from '@prisma/client'
import { NotFoundError, ValidationError } from '@/server/domain/errors'
import {
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  isPurposeAllowed,
  isStoragePurpose,
  isStorageType,
  normalizePurpose,
  type StoragePurpose,
  type StorageType,
} from '@/server/domain/storage/locations'
import { IMAGE_REJECTION_MESSAGE, checkImage } from '@/server/domain/storage/image'
import type { ImageStorage } from '@/server/http/image-storage'
import type { AuthenticatedUser } from '@/server/application/auth'

/**
 * Criar, editar e excluir locais de armazenamento (telas 22 e 24).
 *
 * Camada: application.
 *
 * ## A ordem entre o arquivo e a linha
 *
 * A imagem sobe **antes** da escrita no banco, e é apagada se a escrita falhar.
 * O contrário — gravar a linha e depois subir — deixaria um local sem a foto que
 * a pessoa acabou de escolher, e sem nada que diga isso a ela.
 *
 * Apagar a foto antiga acontece **depois** de a linha já apontar para a nova, e
 * o erro ali é engolido de propósito: um arquivo órfão custa alguns kilobytes,
 * e derrubar uma edição bem-sucedida por causa da faxina custaria o trabalho da
 * pessoa.
 */

export interface LocationInput {
  name: string
  description: string | null
  type: string
  purpose: string | null
  /** Bytes do arquivo enviado. Ausente significa "não mexer na foto". */
  image?: Uint8Array
  /** Marcar para tirar a foto atual sem pôr outra. */
  removeImage?: boolean
}

interface ValidLocation {
  name: string
  description: string | null
  type: StorageType
  purpose: StoragePurpose | null
}

export async function createStorageLocation(
  prisma: PrismaClient,
  storage: ImageStorage,
  user: AuthenticatedUser,
  input: LocationInput,
): Promise<{ id: string }> {
  const valid = validate(input)
  const image = await uploadIfPresent(storage, user, input)

  try {
    const created = await prisma.storageLocation.create({
      data: { userId: user.id, ...valid, image },
      select: { id: true },
    })
    return { id: String(created.id) }
  } catch (error) {
    if (image) await forget(storage, image)
    throw error
  }
}

export async function updateStorageLocation(
  prisma: PrismaClient,
  storage: ImageStorage,
  user: AuthenticatedUser,
  id: bigint,
  input: LocationInput,
): Promise<void> {
  const valid = validate(input)

  const current = await prisma.storageLocation.findFirst({
    where: { id, userId: user.id },
    select: { id: true, image: true },
  })
  if (!current) throw new NotFoundError('Local não encontrado.')

  const uploaded = await uploadIfPresent(storage, user, input)
  const image = uploaded ?? (input.removeImage ? null : undefined)

  try {
    await prisma.storageLocation.update({ where: { id: current.id }, data: { ...valid, image } })
  } catch (error) {
    if (uploaded) await forget(storage, uploaded)
    throw error
  }

  // A linha já aponta para a nova; a antiga não serve mais a ninguém.
  if (current.image && image !== undefined && current.image !== image) {
    await forget(storage, current.image)
  }
}

/**
 * Excluir um local.
 *
 * As alocações vão junto por `ON DELETE CASCADE`, e é isso que se quer: elas
 * dizem "estas cópias estão neste binder", e o binder deixou de existir. **A
 * coleção não muda** — a pessoa continua tendo as cartas, agora sem lugar
 * registrado, que é um estado normal (`business-rules.md` 3.2).
 */
export async function deleteStorageLocation(
  prisma: PrismaClient,
  storage: ImageStorage,
  user: AuthenticatedUser,
  id: bigint,
): Promise<void> {
  const current = await prisma.storageLocation.findFirst({
    where: { id, userId: user.id },
    select: { id: true, image: true },
  })
  if (!current) throw new NotFoundError('Local não encontrado.')

  await prisma.storageLocation.delete({ where: { id: current.id } })
  if (current.image) await forget(storage, current.image)
}

function validate(input: LocationInput): ValidLocation {
  const fields: Record<string, string[]> = {}

  const name = input.name.trim()
  if (!name) fields.name = ['Dê um nome ao local.']
  else if (name.length > NAME_MAX_LENGTH) {
    fields.name = [`O nome pode ter até ${NAME_MAX_LENGTH} caracteres.`]
  }

  const description = input.description?.trim() || null
  if (description && description.length > DESCRIPTION_MAX_LENGTH) {
    fields.description = [`A descrição pode ter até ${DESCRIPTION_MAX_LENGTH} caracteres.`]
  }

  if (!isStorageType(input.type)) {
    fields.type = ['Escolha binder, caixa ou deck.']
    // Sem tipo válido não dá para julgar a finalidade: a regra depende dele.
    throw new ValidationError('Confira os campos destacados.', fields)
  }
  const type = input.type

  const purpose = input.purpose && isStoragePurpose(input.purpose) ? input.purpose : null
  if (input.purpose && !purpose) fields.purpose = ['Escolha coleção ou troca.']
  else if (!isPurposeAllowed(type, normalizePurpose(type, purpose))) {
    fields.purpose = ['Escolha se este local é de coleção ou de troca.']
  }

  if (Object.keys(fields).length > 0) throw new ValidationError('Confira os campos destacados.', fields)

  return { name, description, type, purpose: normalizePurpose(type, purpose) }
}

async function uploadIfPresent(
  storage: ImageStorage,
  user: AuthenticatedUser,
  input: LocationInput,
): Promise<string | undefined> {
  if (!input.image || input.image.byteLength === 0) return undefined

  if (!storage.available) {
    throw new ValidationError('O envio de imagens não está configurado neste ambiente.', {
      image: ['Não foi possível enviar a imagem agora.'],
    })
  }

  const check = checkImage(input.image)
  if (!check.ok) {
    throw new ValidationError(IMAGE_REJECTION_MESSAGE[check.reason], {
      image: [IMAGE_REJECTION_MESSAGE[check.reason]],
    })
  }

  const stored = await storage.upload({
    // O escopo vem do usuário da sessão, nunca do formulário.
    scope: String(user.id),
    bytes: input.image,
    contentType: check.type,
    extension: check.extension,
  })
  return stored.url
}

/** Faxina de arquivo. Nunca derruba a operação que já deu certo. */
async function forget(storage: ImageStorage, url: string): Promise<void> {
  try {
    await storage.remove(url)
  } catch {
    // Um arquivo órfão é barato; uma edição perdida, não.
  }
}
