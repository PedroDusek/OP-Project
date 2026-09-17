import type { PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { countUnallocated } from '@/server/application/storage/unallocated'
import { countUnreadConversations } from '@/server/application/social/conversations'
import { listReceivedInvites } from '@/server/application/trades/start-trade'
import {
  tradeInvitesNotice,
  unallocatedNotice,
  unreadMessagesNotice,
  type Notice,
} from '@/server/domain/notifications/notices'

/**
 * Os avisos pendentes de quem está na sessão (decisão 080).
 *
 * Camada: application.
 *
 * Primeiro o que tem outra pessoa esperando resposta — mensagens e convites de
 * troca —, depois as cartas sem armazenamento.
 */
export async function readNotices(prisma: PrismaClient, user: AuthenticatedUser): Promise<Notice[]> {
  const [summary, locais, naoLidas, convites] = await Promise.all([
    countUnallocated(prisma, user),
    prisma.storageLocation.count({ where: { userId: user.id } }),
    countUnreadConversations(prisma, user),
    listReceivedInvites(prisma, user),
  ])

  return [
    unreadMessagesNotice(naoLidas),
    tradeInvitesNotice(convites.length),
    unallocatedNotice(summary, locais > 0),
  ].filter(
    (notice): notice is Notice => notice !== null,
  )
}
