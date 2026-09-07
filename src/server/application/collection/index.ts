import { prisma } from '@/server/infrastructure/prisma'
import type { AuthenticatedUser } from '@/server/application/auth'
import {
  getCollectionSummary as getCollectionSummaryWith,
  listPlaysets as listPlaysetsWith,
  searchCollection as searchCollectionWith,
  type CollectionQuery,
} from './read-collection'
import { setCollectionQuantity as setCollectionQuantityWith } from './set-quantity'
import type { Removal } from '@/server/domain/storage/allocation'

/**
 * Ponto de composicao dos casos de uso de colecao.
 *
 * Camada: application, a unica que pode falar com infrastructure.
 *
 * Todos recebem o usuario da sessao, e nenhum aceita um `userId` vindo de fora:
 * a propriedade e verificada escopando a consulta pelo dono, e nao conferindo
 * depois (`architecture.md` 3.5).
 */

export function getCollectionSummary(user: AuthenticatedUser) {
  return getCollectionSummaryWith(prisma, user)
}

export function searchCollection(user: AuthenticatedUser, query: CollectionQuery = {}) {
  return searchCollectionWith(prisma, user, query)
}

export function listPlaysets(user: AuthenticatedUser) {
  return listPlaysetsWith(prisma, user)
}

export function setCollectionQuantity(
  user: AuthenticatedUser,
  cardVariantId: bigint,
  quantity: number,
  removals: readonly Removal[] = [],
) {
  return setCollectionQuantityWith(prisma, user, cardVariantId, quantity, removals)
}

export type { CollectionQuery }
export type { CollectionItemView, CollectionPage, CollectionSummary, PlaysetRow } from './read-collection'
export type { AllocationSnapshot, SetQuantityResult } from './set-quantity'
export { QUANTITY_BELOW_ALLOCATED, RESOLUTION_INVALID } from './set-quantity'
export type { Removal }
