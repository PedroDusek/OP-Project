import type { PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import {
  anonymizedEmail,
  ANONYMIZED_NAME,
  assertDeletionConfirmed,
  deletionCutoff,
  deletionDueAt,
} from '@/server/domain/account/deletion'
import { deletionRequestEmail } from '@/server/domain/account/deletion-email'
import type { AuthAdmin } from '@/server/http/auth-admin'
import type { ImageStorage } from '@/server/http/image-storage'
import type { Mailer } from '@/server/http/mailer'

/**
 * Excluir a conta (decisões 015 e 091).
 *
 * Camada: application.
 *
 * Três casos de uso: pedir, desistir entrando de novo, e anonimizar quem venceu
 * o prazo. O primeiro é da pessoa, o segundo acontece no login, e o terceiro é
 * da tarefa diária — nenhuma rota da aplicação anonimiza.
 */

/** Os estados em que a troca ainda não terminou, e é cancelada no pedido. */
const TROCAS_EM_ANDAMENTO = ['DRAFT', 'PROPOSED', 'NEGOTIATING', 'CONFIRMED']

export interface DeletionRequestDeps {
  mailer: Mailer
  appUrl: string
  now?: Date
}

/**
 * Pede a exclusão.
 *
 * Na mesma transação: marca o pedido e cancela as trocas em andamento. Quem
 * chama encerra a sessão logo depois — a partir daqui, `resolveUser` não
 * reconhece mais esta conta.
 *
 * O e-mail vem depois do commit e não pode desfazer o pedido: se falhar, a
 * pessoa ainda viu na tela o prazo e como desistir.
 */
export async function requestAccountDeletion(
  prisma: PrismaClient,
  { mailer, appUrl, now = new Date() }: DeletionRequestDeps,
  user: AuthenticatedUser,
  confirmation: string,
): Promise<{ dueAt: Date }> {
  assertDeletionConfirmed(confirmation)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { deletionRequestedAt: now } })
    // Cancelar, e nao apagar: a outra pessoa ve na troca o que aconteceu. O
    // convite por link morre junto, senao alguem ainda entraria numa troca
    // cancelada (decisao 091).
    await tx.trade.updateMany({
      where: { status: { in: TROCAS_EM_ANDAMENTO }, participants: { some: { userId: user.id } } },
      data: { status: 'CANCELLED', inviteToken: null },
    })
  })

  const dueAt = deletionDueAt(now)
  if (mailer.available) {
    try {
      await mailer.send(deletionRequestEmail({ to: user.email, name: user.name, dueAt, appUrl }))
    } catch (error) {
      console.error('[exclusao] e-mail do pedido falhou', {
        userId: String(user.id),
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { dueAt }
}

/**
 * Entrar de novo dentro do prazo cancela o pedido (decisão 091).
 *
 * Chamado só por quem cria sessão — entrar com senha e a volta do provedor —, e
 * nunca por `resolveUser`: uma requisição que já estava a caminho quando a
 * pessoa pediu (o sino pergunta sozinho) desfaria o pedido no mesmo segundo.
 *
 * Devolve se havia pedido, para a tela avisar que foi cancelado.
 */
export async function cancelAccountDeletion(prisma: PrismaClient, authUserId: string): Promise<boolean> {
  const { count } = await prisma.user.updateMany({
    where: { authUserId, deletedAt: null, deletionRequestedAt: { not: null } },
    data: { deletionRequestedAt: null },
  })
  return count > 0
}

export interface AnonymizeDeps {
  authAdmin: AuthAdmin
  images: ImageStorage
  now?: Date
}

export interface AnonymizeReport {
  due: number
  anonymized: number
  failed: number
}

/**
 * Anonimiza as contas cujo prazo venceu. Roda na tarefa diária.
 *
 * Por conta, nesta ordem, e cada passo pode ser repetido sem estrago:
 *
 * 1. **Exclui a conta no Supabase Auth.** Primeiro, porque é o dado pessoal que
 *    sobra fora do nosso banco. Se o resto falhar, a pessoa já não entra, e a
 *    próxima execução encontra o pedido ainda de pé e continua — o Auth
 *    responde 404, que é tratado como feito.
 * 2. **Anonimiza no banco**, numa transação: apaga coleção, binders, want list e
 *    bloqueios, e troca nome, e-mail, nome na rede, link do Trade Binder e plano.
 *    Ficam as trocas concluídas, as mensagens e as denúncias, como a decisão 015
 *    e o dono do produto definiram.
 * 3. **Apaga as fotos dos binders** do Storage. Depois do banco, e sem derrubar a
 *    conta: foto que falha fica no log para remoção à mão.
 *
 * Sem a chave de administração, não começa: anonimizar deixando e-mail e senha
 * no provedor seria dizer que excluiu sem ter excluído.
 */
export async function anonymizeDueAccounts(
  prisma: PrismaClient,
  { authAdmin, images, now = new Date() }: AnonymizeDeps,
): Promise<AnonymizeReport> {
  if (!authAdmin.available) {
    throw new Error('A exclusão no Supabase Auth não está configurada (SUPABASE_SECRET_KEY).')
  }

  const vencidas = await prisma.user.findMany({
    where: { deletedAt: null, deletionRequestedAt: { lte: deletionCutoff(now) } },
    select: { id: true, authUserId: true },
    orderBy: { id: 'asc' },
  })

  const report: AnonymizeReport = { due: vencidas.length, anonymized: 0, failed: 0 }

  for (const conta of vencidas) {
    try {
      if (conta.authUserId) await authAdmin.deleteUser(conta.authUserId)
      const fotos = await anonymize(prisma, conta.id, now)
      report.anonymized++

      for (const foto of fotos) {
        await images.remove(foto).catch((error: unknown) => {
          console.error('[exclusao] foto nao removida do Storage', {
            userId: String(conta.id),
            url: foto,
            message: error instanceof Error ? error.message : String(error),
          })
        })
      }
    } catch (error) {
      report.failed++
      console.error('[exclusao] conta nao anonimizada', {
        userId: String(conta.id),
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return report
}

/** A anonimização de uma conta no banco. Devolve as fotos a apagar do Storage. */
async function anonymize(prisma: PrismaClient, userId: bigint, now: Date): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const locais = await tx.storageLocation.findMany({ where: { userId }, select: { image: true } })

    // Os cascades da decisao 015 so disparam com DELETE do usuario, que nunca
    // acontece: cada dado proprio e apagado aqui, explicitamente.
    await tx.userBlock.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } })
    await tx.storageLocation.deleteMany({ where: { userId } })
    await tx.wantItem.deleteMany({ where: { userId } })
    await tx.collection.deleteMany({ where: { userId } })

    await tx.user.update({
      where: { id: userId },
      data: {
        name: ANONYMIZED_NAME,
        email: anonymizedEmail(userId),
        authUserId: null,
        username: null,
        usernameChangedAt: null,
        tradeBinderToken: null,
        tradeBinderTokenCreatedAt: null,
        plan: 'FREE',
        trialStartedAt: null,
        premiumUntil: null,
        deletionRequestedAt: null,
        deletedAt: now,
      },
    })

    return locais.map((local) => local.image).filter((image): image is string => Boolean(image))
  })
}
