import { resolveUser, type AuthenticatedUser } from '@/server/application/auth/resolve-user'
import { AuthenticationError } from '@/server/domain/errors'
import { prisma } from '@/server/infrastructure/prisma'
import type { SessionProvider } from './session-provider'

/**
 * Resolucao de sessao na fronteira HTTP.
 *
 * A regra que isto existe para garantir: o `user_id` usado por qualquer caso de
 * uso vem daqui, nunca do corpo ou da query da requisicao.
 */

let provider: SessionProvider | null = null

export function setSessionProvider(next: SessionProvider | null): void {
  provider = next
}

export function getSessionProvider(): SessionProvider {
  if (!provider) {
    throw new Error(
      'Nenhum SessionProvider configurado. Chame setSessionProvider na inicializacao.',
    )
  }
  return provider
}

export async function currentUser(request: Request): Promise<AuthenticatedUser | null> {
  const identity = await getSessionProvider().identify(request)
  if (!identity) return null
  return resolveUser(prisma, identity)
}

/** Igual a `currentUser`, mas falha quando nao ha sessao. */
export async function requireUser(request: Request): Promise<AuthenticatedUser> {
  const user = await currentUser(request)
  if (!user) throw new AuthenticationError()
  return user
}

export type { AuthenticatedUser }
export type { ProviderIdentity, SessionProvider } from './session-provider'
