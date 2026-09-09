import { prisma } from '@/server/infrastructure/prisma'
import type { AuthenticatedUser } from '@/server/application/auth'
import { listTradeBinder as listTradeBinderWith } from './read-trade-binder'

/**
 * Ponto de composicao dos casos de uso de troca.
 *
 * Camada: application, a unica que pode falar com infrastructure.
 */

export function listTradeBinder(user: AuthenticatedUser) {
  return listTradeBinderWith(prisma, user)
}

export { countCopies } from './read-trade-binder'
export type { TradeBinderCard } from './read-trade-binder'
