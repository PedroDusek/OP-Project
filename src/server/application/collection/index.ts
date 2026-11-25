import { prisma } from '@/server/infrastructure/prisma'
import type { AuthenticatedUser } from '@/server/application/auth'
import {
  getCollectionSummary as getCollectionSummaryWith,
  readDashboard as readDashboardWith,
  searchCollection as searchCollectionWith,
  type CollectionQuery,
} from './read-collection'
import {
  listPlaysetSets as listPlaysetSetsWith,
  searchPlaysets as searchPlaysetsWith,
  type PlaysetQuery,
} from './read-playsets'
import {
  readCollectionDashboard as readCollectionDashboardWith,
  type DashboardFilterInput,
} from './dashboard'
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

export function readCollectionDashboard(user: AuthenticatedUser, filters: DashboardFilterInput = {}) {
  return readCollectionDashboardWith(prisma, user, filters)
}

export function readDashboard(user: AuthenticatedUser) {
  return readDashboardWith(prisma, user)
}

export function searchCollection(user: AuthenticatedUser, query: CollectionQuery = {}) {
  return searchCollectionWith(prisma, user, query)
}

export function listPlaysetSets(user: AuthenticatedUser) {
  return listPlaysetSetsWith(prisma, user)
}

export function searchPlaysets(
  user: AuthenticatedUser,
  setCode: string,
  query: PlaysetQuery = {},
) {
  return searchPlaysetsWith(prisma, user, setCode, query)
}

export function setCollectionQuantity(
  user: AuthenticatedUser,
  cardVariantId: bigint,
  quantity: number,
  removals: readonly Removal[] = [],
) {
  return setCollectionQuantityWith(prisma, user, cardVariantId, quantity, removals)
}

export type { CollectionQuery, PlaysetQuery }
export type { CollectionItemView, CollectionPage, CollectionSummary } from './read-collection'
export type {
  PlaysetCardRow,
  PlaysetFilters,
  PlaysetOverview,
  PlaysetSetSummary,
} from './read-playsets'
export type { AllocationSnapshot, SetQuantityResult } from './set-quantity'
export { QUANTITY_BELOW_ALLOCATED, RESOLUTION_INVALID } from './set-quantity'
export type { Removal }

export type { CollectionDashboard, DashboardFilterInput } from './dashboard'
