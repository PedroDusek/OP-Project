import type { PrismaClient } from '@prisma/client'
import type { AuthAdmin, AuthUserDirectory } from '@/server/http/auth-admin'
import type { ImageStorage } from '@/server/http/image-storage'

/**
 * Zerar os usuários (pedido do dono do produto em 19/09).
 *
 * Camada: application.
 *
 * Antes do teste com gente de verdade, o dono do produto quis começar sem
 * nenhuma conta: as de teste saem todas, e ele cria a dele de novo. Isto
 * **não** é a exclusão de conta da decisão 091, que anonimiza uma pessoa e
 * preserva o histórico dos outros. Aqui não há outros: sai tudo o que é de
 * pessoa, e fica tudo o que é do catálogo — cartas, sets, preços, cotação.
 *
 * Só o comando `npm run supabase limpar-contas --confirmar` chama. Nenhuma rota
 * da aplicação alcança isto, e sem `--confirmar` o comando só mostra o
 * levantamento.
 *
 * ## A ordem
 *
 * Trocas, conversas e denúncias recusam a exclusão da pessoa enquanto existem
 * (`onDelete: Restrict` — é o que protege o histórico dos outros no uso
 * normal). Então saem primeiro, e a pessoa sai depois, levando junto o que é
 * só dela: coleção, locais, want list, bloqueios.
 *
 * O banco antes do provedor: se o provedor falhar no meio, o banco já está
 * limpo e rodar de novo termina o trabalho — `deleteUser` aceita conta que já
 * não existe. Ao contrário, sobraria gente no banco sem login para entrar.
 */

export interface AccountSurvey {
  users: {
    email: string
    createdAt: Date
    cards: number
    locations: number
    wants: number
  }[]
  trades: number
  conversations: number
  reports: number
  /** Contas no provedor, inclusive as que nunca ganharam linha em `users`. */
  authUsers: number
  /** Fotos de binder guardadas no Storage. */
  images: number
}

export interface PurgeDeps {
  authAdmin: AuthAdmin
  directory: AuthUserDirectory
  images: ImageStorage
}

export interface PurgeReport {
  users: number
  trades: number
  conversations: number
  reports: number
  authDeleted: number
  authFailed: number
  imagesRemoved: number
  imagesFailed: number
}

/** O que seria apagado. Não muda nada. */
export async function surveyAccounts(prisma: PrismaClient, directory: AuthUserDirectory): Promise<AccountSurvey> {
  const [users, trades, conversations, reports, images, authUsers] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        email: true,
        createdAt: true,
        collection: { select: { _count: { select: { items: true } } } },
        _count: { select: { storageLocations: true, wantItems: true } },
      },
    }),
    prisma.trade.count(),
    prisma.conversation.count(),
    prisma.userReport.count(),
    prisma.storageLocation.count({ where: { image: { not: null } } }),
    directory.listUsers(),
  ])

  return {
    users: users.map((user) => ({
      email: user.email,
      createdAt: user.createdAt,
      cards: user.collection?._count.items ?? 0,
      locations: user._count.storageLocations,
      wants: user._count.wantItems,
    })),
    trades,
    conversations,
    reports,
    authUsers: authUsers.length,
    images,
  }
}

/** Apaga todas as contas: no banco, no provedor e as fotos no Storage. */
export async function purgeAllAccounts(prisma: PrismaClient, deps: PurgeDeps): Promise<PurgeReport> {
  // Os endereços das fotos antes de apagar os locais que os guardam.
  const fotos = (
    await prisma.storageLocation.findMany({ where: { image: { not: null } }, select: { image: true } })
  ).map((location) => location.image!)

  const [trades, conversations, reports, users] = await prisma.$transaction([
    prisma.trade.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.userReport.deleteMany(),
    prisma.user.deleteMany(),
  ])

  let authDeleted = 0
  let authFailed = 0
  for (const account of await deps.directory.listUsers()) {
    try {
      await deps.authAdmin.deleteUser(account.id)
      authDeleted++
    } catch {
      authFailed++
    }
  }

  // Foto que ficou para trás não é dado de ninguém que o banco aponte, e não
  // derruba a limpeza.
  let imagesRemoved = 0
  let imagesFailed = 0
  for (const foto of fotos) {
    try {
      await deps.images.remove(foto)
      imagesRemoved++
    } catch {
      imagesFailed++
    }
  }

  return {
    users: users.count,
    trades: trades.count,
    conversations: conversations.count,
    reports: reports.count,
    authDeleted,
    authFailed,
    imagesRemoved,
    imagesFailed,
  }
}
