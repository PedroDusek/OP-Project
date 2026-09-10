import { prisma } from '@/server/infrastructure/prisma'
import type { AuthenticatedUser } from '@/server/application/auth'
import { listTradeBinder as listTradeBinderWith } from './read-trade-binder'
import {
  getOpenTrade as getOpenTradeWith,
  getTrade as getTradeWith,
} from './read-trade'
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
import {
  markExchange as markExchangeWith,
  withdrawExchange as withdrawExchangeWith,
  type OriginChoice,
} from './complete-trade'
import {
  getTradeBinderShare as getTradeBinderShareWith,
  publishTradeBinder as publishTradeBinderWith,
  readPublicTradeBinder as readPublicTradeBinderWith,
  revokeTradeBinder as revokeTradeBinderWith,
} from './public-binder'

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

export function getOpenTrade(user: AuthenticatedUser) {
  return getOpenTradeWith(prisma, user)
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

export function markExchange(
  user: AuthenticatedUser,
  tradeId: bigint,
  choices: readonly OriginChoice[] = [],
) {
  return markExchangeWith(prisma, user, tradeId, choices)
}

export function withdrawExchange(user: AuthenticatedUser, tradeId: bigint) {
  return withdrawExchangeWith(prisma, user, tradeId)
}

export function getTradeBinderShare(user: AuthenticatedUser) {
  return getTradeBinderShareWith(prisma, user)
}

export function publishTradeBinder(user: AuthenticatedUser) {
  return publishTradeBinderWith(prisma, user)
}

export function revokeTradeBinder(user: AuthenticatedUser) {
  return revokeTradeBinderWith(prisma, user)
}

/**
 * Le um Trade Binder publicado. **Sem usuario**, de proposito: a pagina e
 * publica, e quem tem o link entra (regra 6.1).
 */
export function readPublicTradeBinder(token: string) {
  return readPublicTradeBinderWith(prisma, token)
}

export { countCopies } from './read-trade-binder'
export { USERNAME_REQUIRED } from './public-binder'
export type {
  PublicBinder,
  PublicBinderCard,
  TradeBinderShare,
} from './public-binder'
export { ORIGIN_CHOICE_REQUIRED } from './complete-trade'
export type { TradeBinderCard } from './read-trade-binder'
export type { StartedTrade } from './start-trade'
export type { OfferChange } from './edit-offer'
export type {
  MarkExchangeResult,
  OriginChoice,
  OriginLocation,
  OriginQuestion,
} from './complete-trade'
export type { TradeView, TradeSideView, TradeCardOffer, OpenTrade } from './read-trade'
