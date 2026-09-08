import { prisma } from '@/server/infrastructure/prisma'
import { SupabaseImageStorage } from '@/server/infrastructure/storage/supabase-image-storage'
import type { AuthenticatedUser } from '@/server/application/auth'
import {
  getStorageLocation as getStorageLocationWith,
  listCardsInLocation as listCardsInLocationWith,
  listStorageLocations as listStorageLocationsWith,
  type StoredCardsQuery,
} from './read-locations'
import {
  createStorageLocation as createStorageLocationWith,
  deleteStorageLocation as deleteStorageLocationWith,
  updateStorageLocation as updateStorageLocationWith,
  type LocationInput,
} from './write-locations'
import {
  addAllocation as addAllocationWith,
  listVariantAllocations as listVariantAllocationsWith,
  setAllocation as setAllocationWith,
} from './allocate'
import {
  countUnallocated as countUnallocatedWith,
  listUnallocated as listUnallocatedWith,
} from './unallocated'
import { moveAllocation as moveAllocationWith } from './move'
import { bulkAddToLocation as bulkAddToLocationWith, type BulkEntry } from './bulk'

/**
 * Ponto de composicao dos casos de uso de armazenamento.
 *
 * Camada: application, a unica que pode falar com infrastructure.
 *
 * Nenhum aceita `userId` de fora: a propriedade vem de escopar a consulta pelo
 * dono da sessao (`architecture.md` 3.5).
 */

const images = new SupabaseImageStorage()

/** A tela esconde o campo de foto quando o provedor nao esta configurado. */
export function imageUploadAvailable(): boolean {
  return images.available
}

export function listStorageLocations(user: AuthenticatedUser) {
  return listStorageLocationsWith(prisma, user)
}

export function getStorageLocation(user: AuthenticatedUser, id: bigint) {
  return getStorageLocationWith(prisma, user, id)
}

export function listCardsInLocation(
  user: AuthenticatedUser,
  id: bigint,
  query: StoredCardsQuery = {},
) {
  return listCardsInLocationWith(prisma, user, id, query)
}

export function createStorageLocation(user: AuthenticatedUser, input: LocationInput) {
  return createStorageLocationWith(prisma, images, user, input)
}

export function updateStorageLocation(user: AuthenticatedUser, id: bigint, input: LocationInput) {
  return updateStorageLocationWith(prisma, images, user, id, input)
}

export function deleteStorageLocation(user: AuthenticatedUser, id: bigint) {
  return deleteStorageLocationWith(prisma, images, user, id)
}

export function listVariantAllocations(user: AuthenticatedUser, cardVariantId: bigint) {
  return listVariantAllocationsWith(prisma, user, cardVariantId)
}

export function setAllocation(
  user: AuthenticatedUser,
  cardVariantId: bigint,
  storageLocationId: bigint,
  quantity: number,
) {
  return setAllocationWith(prisma, user, cardVariantId, storageLocationId, quantity)
}

export function addAllocation(
  user: AuthenticatedUser,
  cardVariantId: bigint,
  storageLocationId: bigint,
  copies: number,
) {
  return addAllocationWith(prisma, user, cardVariantId, storageLocationId, copies)
}

export function countUnallocated(user: AuthenticatedUser) {
  return countUnallocatedWith(prisma, user)
}

export function listUnallocated(user: AuthenticatedUser) {
  return listUnallocatedWith(prisma, user)
}

export function moveAllocation(
  user: AuthenticatedUser,
  cardVariantId: bigint,
  fromStorageLocationId: bigint,
  toStorageLocationId: bigint,
  copies: number,
) {
  return moveAllocationWith(
    prisma,
    user,
    cardVariantId,
    fromStorageLocationId,
    toStorageLocationId,
    copies,
  )
}

export function bulkAddToLocation(
  user: AuthenticatedUser,
  storageLocationId: bigint,
  entries: readonly BulkEntry[],
) {
  return bulkAddToLocationWith(prisma, user, storageLocationId, entries)
}

export type { BulkEntry }
export type { LocationInput, StoredCardsQuery }
export type { BulkAddResult } from './bulk'
export type { MoveResult } from './move'
export { MAX_BULK_ENTRIES } from './bulk'
export { NOT_ENOUGH_HERE } from './move'
export type { UnallocatedCard, UnallocatedSummary } from './unallocated'
export type {
  StorageLocationDetail,
  StorageLocationSummary,
  StoredCardView,
} from './read-locations'
export type { AllocationView, SetAllocationResult, VariantAllocations } from './allocate'
export { ALLOCATION_EXCEEDS_OWNED } from './allocate'
