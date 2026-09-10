import { prisma } from '@/server/infrastructure/prisma'
import type { AuthenticatedUser } from '@/server/application/auth'
import {
  getUsernameState as getUsernameStateWith,
  setUsername as setUsernameWith,
} from './set-username'

/**
 * Ponto de composicao dos casos de uso da rede.
 *
 * Camada: application, a unica que pode falar com infrastructure.
 */

export function getUsernameState(user: AuthenticatedUser) {
  return getUsernameStateWith(prisma, user)
}

export function setUsername(user: AuthenticatedUser, raw: string) {
  return setUsernameWith(prisma, user, raw)
}

export type { SetUsernameResult, UsernameState } from './set-username'
