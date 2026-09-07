import { userFromRequest, type AuthenticatedUser } from '@/server/application/auth'
import { AuthenticationError } from '@/server/domain/errors'

/**
 * Sessao na fronteira HTTP.
 *
 * A regra que isto existe para garantir: o `user_id` usado por qualquer caso de
 * uso vem daqui, nunca do corpo nem da query da requisicao. Nenhuma rota deve
 * ter outro caminho para descobrir quem esta chamando.
 */

export async function currentUser(request: Request): Promise<AuthenticatedUser | null> {
  return userFromRequest(request)
}

/** Igual a `currentUser`, mas falha quando nao ha sessao valida. */
export async function requireUser(request: Request): Promise<AuthenticatedUser> {
  const user = await currentUser(request)
  if (!user) throw new AuthenticationError()
  return user
}

export { setSessionProvider } from '@/server/application/auth'
export type { AuthenticatedUser }
export type { ProviderIdentity, SessionProvider } from './session-provider'
