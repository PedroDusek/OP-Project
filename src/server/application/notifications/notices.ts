import type { PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { countUnallocated } from '@/server/application/storage/unallocated'
import { unallocatedNotice, type Notice } from '@/server/domain/notifications/notices'

/**
 * Os avisos pendentes de quem está na sessão (decisão 080).
 *
 * Camada: application.
 *
 * Hoje é um só — cartas sem armazenamento. As mensagens não lidas entram quando
 * as conversas existirem.
 */
export async function readNotices(prisma: PrismaClient, user: AuthenticatedUser): Promise<Notice[]> {
  const [summary, locais] = await Promise.all([
    countUnallocated(prisma, user),
    prisma.storageLocation.count({ where: { userId: user.id } }),
  ])

  return [unallocatedNotice(summary, locais > 0)].filter((notice): notice is Notice => notice !== null)
}
