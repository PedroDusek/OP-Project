import type { PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { countUnallocated } from '@/server/application/storage/unallocated'
import { countUnreadConversations } from '@/server/application/social/conversations'
import { unallocatedNotice, unreadMessagesNotice, type Notice } from '@/server/domain/notifications/notices'

/**
 * Os avisos pendentes de quem está na sessão (decisão 080).
 *
 * Camada: application.
 *
 * As mensagens não lidas vêm primeiro: é o aviso de outra pessoa esperando
 * resposta. Depois as cartas sem armazenamento.
 */
export async function readNotices(prisma: PrismaClient, user: AuthenticatedUser): Promise<Notice[]> {
  const [summary, locais, naoLidas] = await Promise.all([
    countUnallocated(prisma, user),
    prisma.storageLocation.count({ where: { userId: user.id } }),
    countUnreadConversations(prisma, user),
  ])

  return [unreadMessagesNotice(naoLidas), unallocatedNotice(summary, locais > 0)].filter(
    (notice): notice is Notice => notice !== null,
  )
}
