import { prisma } from '@/server/infrastructure/prisma'
import type { AuthenticatedUser } from '@/server/application/auth'
import { readNotices as readNoticesWith } from './notices'

/**
 * Ponto de composição dos avisos do sino.
 *
 * Camada: application, a única que pode falar com infrastructure.
 */

export function readNotices(user: AuthenticatedUser) {
  return readNoticesWith(prisma, user)
}

export type { Notice } from '@/server/domain/notifications/notices'
