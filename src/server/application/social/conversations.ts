import { Prisma, type PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from '@/server/domain/errors'
import {
  CONVERSATION_PAGE,
  conversationPairKey,
  messageSnippet,
  normalizeMessageBody,
  sendBlockedReason,
} from '@/server/domain/social/conversations'
import { normalizeUsername } from '@/server/domain/social/username'
import { consumeRateLimit, MESSAGE_SEND_LIMIT } from '@/server/http/rate-limit'

/**
 * As conversas entre pessoas da rede (decisão 081).
 *
 * Camada: application.
 *
 * ## Quem conversa
 *
 * Qualquer pessoa da rede com nome de usuário — escolha do dono do produto. O
 * nome é a única identidade que a outra pessoa vê (regra 6.1.1), então quem não
 * escolheu um ainda não conversa.
 *
 * ## O bloqueio
 *
 * Quem foi bloqueado não abre conversa nem escreve para quem bloqueou (regra
 * 6.1.4, estendida com aprovação do dono do produto). Quem bloqueou também não
 * escreve — a outra pessoa não poderia responder. As mensagens antigas
 * continuam à vista dos dois.
 *
 * ## Participar é a autorização
 *
 * Toda leitura e toda escrita confere que quem está na sessão participa da
 * conversa. Quem não participa recebe "não encontrada" — a mesma resposta de uma
 * conversa que não existe.
 */

export const USERNAME_REQUIRED_TO_CHAT = 'NOME_DE_USUARIO_NECESSARIO_PARA_CONVERSAR'

async function exigirNome(prisma: PrismaClient, viewer: AuthenticatedUser): Promise<void> {
  const eu = await prisma.user.findUniqueOrThrow({ where: { id: viewer.id }, select: { username: true } })
  if (!eu.username) {
    throw new ConflictError(
      USERNAME_REQUIRED_TO_CHAT,
      'Escolha seu nome na rede em Minha conta antes de conversar: é ele que a outra pessoa vê.',
    )
  }
}

async function bloqueios(prisma: PrismaClient, viewerId: bigint, otherId: bigint) {
  const rows = await prisma.userBlock.findMany({
    where: {
      OR: [
        { blockerId: viewerId, blockedId: otherId },
        { blockerId: otherId, blockedId: viewerId },
      ],
    },
    select: { blockerId: true },
  })
  return {
    viewerBlockedOther: rows.some((row) => row.blockerId === viewerId),
    otherBlockedViewer: rows.some((row) => row.blockerId === otherId),
  }
}

/**
 * Abre a conversa com alguém, ou devolve a que já existe. Uma por par: quem
 * abre primeiro não importa.
 */
export async function startConversation(
  prisma: PrismaClient,
  viewer: AuthenticatedUser,
  username: string,
): Promise<bigint> {
  await exigirNome(prisma, viewer)

  const outra = await prisma.user.findUnique({
    where: { username: normalizeUsername(username) },
    select: { id: true, username: true, deletedAt: true },
  })
  if (!outra || outra.deletedAt || !outra.username) throw new NotFoundError('Ninguém na rede tem esse nome.')
  if (outra.id === viewer.id) throw new ValidationError('Você não pode conversar consigo mesmo.')

  const motivo = sendBlockedReason(await bloqueios(prisma, viewer.id, outra.id))
  if (motivo) throw new AuthorizationError(motivo)

  const pairKey = conversationPairKey(viewer.id, outra.id)
  const criar = () =>
    prisma.$transaction(async (tx) => {
      const conversa = await tx.conversation.upsert({
        where: { pairKey },
        create: { pairKey },
        update: {},
        select: { id: true },
      })
      await tx.conversationParticipant.createMany({
        data: [
          { conversationId: conversa.id, userId: viewer.id },
          { conversationId: conversa.id, userId: outra.id },
        ],
        skipDuplicates: true,
      })
      return conversa.id
    })

  try {
    return await criar()
  } catch (error) {
    // Duas pessoas abrindo a mesma conversa ao mesmo tempo: o indice unico do par
    // recusa a segunda criacao, e a segunda tentativa encontra a primeira.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return criar()
    throw error
  }
}

export interface ConversationSummary {
  id: string
  /** O nome da outra pessoa, ou `null` se a conta saiu. */
  otherUsername: string | null
  lastMessageAt: Date
  snippet: string
  lastFromMe: boolean
  unread: boolean
}

/** As conversas com alguma mensagem, da mais recente para a mais antiga. */
export async function listConversations(
  prisma: PrismaClient,
  viewer: AuthenticatedUser,
): Promise<ConversationSummary[]> {
  const participacoes = await prisma.conversationParticipant.findMany({
    where: { userId: viewer.id, conversation: { lastMessageAt: { not: null } } },
    select: {
      lastReadAt: true,
      conversation: {
        select: {
          id: true,
          lastMessageAt: true,
          participants: {
            where: { userId: { not: viewer.id } },
            select: { user: { select: { username: true, deletedAt: true } } },
          },
          messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, senderId: true } },
        },
      },
    },
    orderBy: { conversation: { lastMessageAt: 'desc' } },
  })

  const naoLidas = await unreadConversationIds(prisma, viewer)

  return participacoes
    .filter((p) => p.conversation.messages.length > 0)
    .map((p) => {
      const outra = p.conversation.participants[0]?.user
      const ultima = p.conversation.messages[0]
      return {
        id: String(p.conversation.id),
        otherUsername: outra && !outra.deletedAt ? outra.username : null,
        lastMessageAt: p.conversation.lastMessageAt!,
        snippet: messageSnippet(ultima.body),
        lastFromMe: ultima.senderId === viewer.id,
        unread: naoLidas.has(String(p.conversation.id)),
      }
    })
}

/** As conversas com mensagem da outra pessoa depois da última leitura. */
async function unreadConversationIds(prisma: PrismaClient, viewer: AuthenticatedUser): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ conversation_id: bigint }[]>(Prisma.sql`
    SELECT cp.conversation_id
      FROM conversation_participants cp
     WHERE cp.user_id = ${viewer.id}
       AND EXISTS (
         SELECT 1 FROM messages m
          WHERE m.conversation_id = cp.conversation_id
            AND m.sender_id <> cp.user_id
            AND m.created_at > COALESCE(cp.last_read_at, '-infinity'::timestamptz)
       )
  `)
  return new Set(rows.map((row) => String(row.conversation_id)))
}

/** Quantas conversas têm mensagem não lida: o aviso do sino (decisão 080). */
export async function countUnreadConversations(prisma: PrismaClient, viewer: AuthenticatedUser): Promise<number> {
  return (await unreadConversationIds(prisma, viewer)).size
}

export interface ConversationMessage {
  id: string
  body: string
  createdAt: Date
  mine: boolean
}

export interface ConversationView {
  id: string
  otherUsername: string | null
  messages: ConversationMessage[]
  /** Por que não dá para escrever, ou `null` quando dá. */
  sendBlocked: string | null
  /** Quem olha bloqueou a outra pessoa: a tela oferece desbloquear. */
  viewerBlockedOther: boolean
}

async function participacao(prisma: PrismaClient, viewer: AuthenticatedUser, conversationId: bigint) {
  const eu = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: viewer.id } },
    select: { id: true },
  })
  if (!eu) throw new NotFoundError('Conversa não encontrada.')

  const outra = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: { not: viewer.id } },
    select: { user: { select: { id: true, username: true, deletedAt: true } } },
  })
  if (!outra) throw new NotFoundError('Conversa não encontrada.')
  return { participanteId: eu.id, outra: outra.user }
}

async function motivoParaNaoEnviar(
  prisma: PrismaClient,
  viewer: AuthenticatedUser,
  outra: { id: bigint; deletedAt: Date | null; username: string | null },
) {
  if (outra.deletedAt || !outra.username) {
    return { motivo: 'Esta conta saiu da rede.', viewerBlockedOther: false }
  }
  const estado = await bloqueios(prisma, viewer.id, outra.id)
  return { motivo: sendBlockedReason(estado), viewerBlockedOther: estado.viewerBlockedOther }
}

/**
 * Abre a conversa: as mensagens mais recentes, e marca como lida até agora.
 *
 * Ler marca lido — é o que apaga o pontinho do sino. Não há confirmação de
 * leitura para a outra pessoa.
 */
export async function readConversation(
  prisma: PrismaClient,
  viewer: AuthenticatedUser,
  conversationId: bigint,
  now: Date = new Date(),
): Promise<ConversationView> {
  const { participanteId, outra } = await participacao(prisma, viewer, conversationId)
  const { motivo, viewerBlockedOther } = await motivoParaNaoEnviar(prisma, viewer, outra)

  const recentes = await prisma.message.findMany({
    where: { conversationId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: CONVERSATION_PAGE,
    select: { id: true, body: true, createdAt: true, senderId: true },
  })

  // Lido ate a mensagem mais recente, mesmo que o relogio desta maquina esteja
  // atras do que gravou a mensagem: senao abrir a conversa nao apagaria o aviso.
  const maisRecente = recentes[0]?.createdAt
  const lidoAte = maisRecente && maisRecente > now ? maisRecente : now
  await prisma.conversationParticipant.update({ where: { id: participanteId }, data: { lastReadAt: lidoAte } })

  return {
    id: String(conversationId),
    otherUsername: outra.deletedAt ? null : outra.username,
    messages: recentes.reverse().map((m) => ({
      id: String(m.id),
      body: m.body,
      createdAt: m.createdAt,
      mine: m.senderId === viewer.id,
    })),
    sendBlocked: motivo,
    viewerBlockedOther,
  }
}

/**
 * O que a conversa aberta pergunta a cada poucos segundos: se chegou mensagem ou
 * se o bloqueio mudou. Não marca lido — quem marca é a tela, ao se redesenhar.
 */
export async function conversationState(
  prisma: PrismaClient,
  viewer: AuthenticatedUser,
  conversationId: bigint,
): Promise<{ lastMessageId: string | null; sendBlocked: string | null }> {
  const { outra } = await participacao(prisma, viewer, conversationId)
  const [ultima, { motivo }] = await Promise.all([
    prisma.message.findFirst({
      where: { conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    }),
    motivoParaNaoEnviar(prisma, viewer, outra),
  ])
  return { lastMessageId: ultima ? String(ultima.id) : null, sendBlocked: motivo }
}

/** Envia uma mensagem. Quem envia já leu até ela. */
export async function sendMessage(
  prisma: PrismaClient,
  viewer: AuthenticatedUser,
  conversationId: bigint,
  rawBody: string,
  now: Date = new Date(),
): Promise<ConversationMessage> {
  const body = normalizeMessageBody(rawBody)
  const { participanteId, outra } = await participacao(prisma, viewer, conversationId)
  await exigirNome(prisma, viewer)

  const { motivo } = await motivoParaNaoEnviar(prisma, viewer, outra)
  if (motivo) throw new AuthorizationError(motivo)

  consumeRateLimit(`conversa:envio:${viewer.id}`, MESSAGE_SEND_LIMIT)

  const mensagem = await prisma.$transaction(async (tx) => {
    const criada = await tx.message.create({
      // A hora vem da aplicacao, como a da leitura: comparar hora do banco com
      // hora da aplicacao deixaria mensagem lida parecendo nao lida.
      data: { conversationId, senderId: viewer.id, body, createdAt: now },
      select: { id: true, body: true, createdAt: true },
    })
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: criada.createdAt } })
    await tx.conversationParticipant.update({ where: { id: participanteId }, data: { lastReadAt: criada.createdAt } })
    return criada
  })

  return { id: String(mensagem.id), body: mensagem.body, createdAt: mensagem.createdAt, mine: true }
}
