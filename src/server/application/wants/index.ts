import { prisma } from '@/server/infrastructure/prisma'
import type { AuthenticatedUser } from '@/server/application/auth'
import {
  getWantQuantity as getWantQuantityWith,
  getWantSummary as getWantSummaryWith,
  listWants as listWantsWith,
  type WantQuery,
} from './read-wants'
import { setWantQuantity as setWantQuantityWith } from './set-want'

/**
 * Ponto de composicao dos casos de uso de want.
 *
 * Camada: application, a unica que pode falar com infrastructure.
 *
 * Nenhum aceita `userId` de fora: a want list e escopada pelo dono da sessao
 * (`architecture.md` 3.5).
 */

export function listWants(user: AuthenticatedUser, query: WantQuery = {}) {
  return listWantsWith(prisma, user, query)
}

export function getWantSummary(user: AuthenticatedUser) {
  return getWantSummaryWith(prisma, user)
}

export function getWantQuantity(user: AuthenticatedUser, cardVariantId: bigint) {
  return getWantQuantityWith(prisma, user, cardVariantId)
}

export function setWantQuantity(
  user: AuthenticatedUser,
  cardVariantId: bigint,
  quantity: number,
) {
  return setWantQuantityWith(prisma, user, cardVariantId, quantity)
}

export type { WantQuery }
export type { WantSummary, WantView } from './read-wants'
export type { SetWantResult } from './set-want'
