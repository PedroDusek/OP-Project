import { prisma } from '@/server/infrastructure/prisma'
import { ResendMailer } from '@/server/infrastructure/email/resend-mailer'
import { appUrl } from '@/server/http/app-url'
import type { AuthenticatedUser } from '@/server/application/auth'
import {
  cancelAccountDeletion as cancelAccountDeletionWith,
  requestAccountDeletion as requestAccountDeletionWith,
} from './delete-account'

/**
 * Ponto de composição da conta.
 *
 * Camada: application, a única que pode falar com infrastructure.
 *
 * A anonimização não está aqui de propósito: ela só roda pela tarefa diária
 * (`npm run supabase contas`), nunca por uma rota da aplicação.
 */

const mailer = new ResendMailer()

export function requestAccountDeletion(user: AuthenticatedUser, confirmation: string) {
  return requestAccountDeletionWith(prisma, { mailer, appUrl: appUrl() }, user, confirmation)
}

/** Entrar de novo dentro do prazo desiste do pedido. Passado a `signIn` e `completeOAuth`. */
export function cancelAccountDeletion(authUserId: string) {
  return cancelAccountDeletionWith(prisma, authUserId)
}

export { ACCOUNT_DELETION_CONFIRMATION, ACCOUNT_DELETION_GRACE_DAYS } from '@/server/domain/account/deletion'
