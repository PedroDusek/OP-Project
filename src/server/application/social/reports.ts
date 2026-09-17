import type { PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { isAdmin } from '@/server/application/authorization'
import { NotFoundError } from '@/server/domain/errors'

/**
 * As denúncias, para quem administra (regra 6.1.4, decisão 079).
 *
 * Camada: application.
 *
 * A regra diz que o que se faz com elas é processo, e não produto: aqui só se
 * lê. Quem não administra recebe `NotFoundError`, a mesma resposta de uma tela
 * que não existe.
 *
 * O e-mail aparece para quem administra, e só para ele: é quem responde pela
 * moderação, e o nome de usuário muda uma vez por semana.
 */

export interface ReportView {
  id: string
  createdAt: Date
  reason: string
  reporter: { username: string | null; email: string }
  reported: { username: string | null; email: string }
}

/** As denúncias mais recentes primeiro. Duzentas bastam para ler; o resto espera. */
export async function listReports(prisma: PrismaClient, viewer: AuthenticatedUser): Promise<ReportView[]> {
  if (!isAdmin(viewer)) throw new NotFoundError()

  const rows = await prisma.userReport.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      createdAt: true,
      reason: true,
      reporter: { select: { username: true, email: true } },
      reported: { select: { username: true, email: true } },
    },
  })
  return rows.map((row) => ({ ...row, id: String(row.id) }))
}
