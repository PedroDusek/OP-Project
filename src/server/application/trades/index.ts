import { prisma } from '@/server/infrastructure/prisma'
import type { AuthenticatedUser } from '@/server/application/auth'
import { listTradeBinder as listTradeBinderWith } from './read-trade-binder'
import { getTrade as getTradeWith } from './read-trade'
import {
  joinTrade as joinTradeWith,
  startTrade as startTradeWith,
} from './start-trade'
import {
  cancelTrade as cancelTradeWith,
  confirmTrade as confirmTradeWith,
  setOfferItem as setOfferItemWith,
  withdrawConfirmation as withdrawConfirmationWith,
  type OfferChange,
} from './edit-offer'

/**
 * Ponto de composicao dos casos de uso de troca.
 *
 * Camada: application, a unica que pode falar com infrastructure.
 */

export function listTradeBinder(user: AuthenticatedUser) {
  return listTradeBinderWith(prisma, user)
}

export function startTrade(user: AuthenticatedUser) {
  return startTradeWith(prisma, user)
}

export function joinTrade(user: AuthenticatedUser, inviteToken: string) {
  return joinTradeWith(prisma, user, inviteToken)
}

export function getTrade(user: AuthenticatedUser, tradeId: bigint) {
  return getTradeWith(prisma, user, tradeId)
}

export function setOfferItem(user: AuthenticatedUser, tradeId: bigint, change: OfferChange) {
  return setOfferItemWith(prisma, user, tradeId, change)
}

export function confirmTrade(user: AuthenticatedUser, tradeId: bigint) {
  return confirmTradeWith(prisma, user, tradeId)
}

export function withdrawConfirmation(user: AuthenticatedUser, tradeId: bigint) {
  return withdrawConfirmationWith(prisma, user, tradeId)
}

export function cancelTrade(user: AuthenticatedUser, tradeId: bigint) {
  return cancelTradeWith(prisma, user, tradeId)
}

export { countCopies } from './read-trade-binder'
export type { TradeBinderCard } from './read-trade-binder'
export type { StartedTrade } from './start-trade'
export type { OfferChange } from './edit-offer'
export type { TradeView, TradeSideView, TradeCardOffer } from './read-trade'
