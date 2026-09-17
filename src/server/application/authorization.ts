import { AuthorizationError, NotFoundError } from '@/server/domain/errors'
import type { AuthenticatedUser } from './auth/resolve-user'

/**
 * Propriedade de recurso.
 *
 * Camada: application. A verificacao acontece dentro do caso de uso, contra o
 * usuario da sessao, em toda leitura e toda escrita.
 *
 * ## Prefira escopar a consulta a verificar depois
 *
 * Existem duas formas de proteger um recurso de outro dono:
 *
 *   1. buscar por id e comparar o dono   -> revela que o id existe
 *   2. buscar por id **e** dono          -> id alheio simplesmente nao existe
 *
 * A segunda e a boa. A primeira devolve 403 para recurso alheio e 404 para
 * inexistente, e essa diferenca conta quantos binders o vizinho tem. Use
 * `ownedBy` para montar o filtro; `assertOwnedBy` existe para os casos em que a
 * linha ja veio de outro lugar e ainda assim precisa ser conferida.
 */

/** Filtro de propriedade, para compor com o `where` da consulta. */
export function ownedBy(user: AuthenticatedUser): { userId: bigint } {
  return { userId: user.id }
}

/**
 * Confere o dono de uma linha ja carregada.
 *
 * Lanca `NotFoundError`, e nao `AuthorizationError`, quando o dono difere: para
 * quem chama, um recurso alheio e indistinguivel de um inexistente, que e o que
 * queremos. `AuthorizationError` fica para negar uma acao sobre recurso que a
 * pessoa comprovadamente ve, como um trade de que ela participa.
 */
export function assertOwnedBy(
  resource: { userId: bigint } | null | undefined,
  user: AuthenticatedUser,
): void {
  if (!resource || resource.userId !== user.id) {
    throw new NotFoundError()
  }
}

/**
 * Nega uma acao sobre recurso visivel.
 *
 * Diferente de `assertOwnedBy`: aqui a pessoa ve o recurso e o que se recusa e a
 * operacao. Esconder que ele existe seria mentira, e o 403 e a resposta honesta.
 */
export function assertPermitted(condition: boolean, message?: string): void {
  if (!condition) throw new AuthorizationError(message)
}

/** Recursos Premium. O trial conta como Premium enquanto estiver valido. */
export function isPremium(user: { plan: string; premiumUntil?: Date | null }, now = new Date()): boolean {
  if (user.plan !== 'PREMIUM') return false
  if (!user.premiumUntil) return true
  return user.premiumUntil > now
}
