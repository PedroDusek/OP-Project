import { randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from '@/server/domain/errors'
import { normalizeUsername } from '@/server/domain/social/username'
import { ACTIVE_TRADE_STATUSES } from '@/server/domain/trades/negotiation'

/**
 * Abrir uma troca e entrar numa troca pelo convite.
 *
 * Camada: application.
 *
 * ## Por que existe um convite
 *
 * O protocolo da regra 4.6.1 começa em "o usuário 1 inicia a troca com o 2" — e
 * o produto não tem lista de amigos, nome de usuário público nem busca de
 * pessoas. Buscar por e-mail revelaria quem é cadastrado a quem tentasse, que é
 * vazamento no exato lugar que o protocolo protege.
 *
 * Então quem abre a troca ganha um link, e manda por onde já conversa —
 * WhatsApp, Discord, pessoalmente. Quem abre o link entra. Não há diretório de
 * pessoas para vazar, porque não há diretório (decisão 056).
 *
 * ## O token é longo de propósito
 *
 * Quem entra passa a ver o cruzamento do Trade Binder e da want list de quem
 * convidou. Um código curto de digitar seria adivinhável, e adivinhar um seria
 * entrar na negociação de estranhos. É link para copiar, não código para ditar.
 */

/** 24 bytes em base64url: 32 caracteres, ~192 bits. Cabe na URL e não se adivinha. */
const INVITE_TOKEN_BYTES = 24

export interface StartedTrade {
  tradeId: bigint
  inviteToken: string
}

/**
 * Abre uma troca com uma pessoa só, esperando a segunda.
 *
 * Fica em `DRAFT`: ainda não prende cópia nenhuma nem impede outra troca, e a
 * regra 4.5 só considera ativo a partir de `PROPOSED`. Um convite que ninguém
 * aceitou não compromete nada, e travar a pessoa por causa dele seria cobrar
 * por algo que não aconteceu.
 */
export async function startTrade(
  prisma: PrismaClient,
  user: AuthenticatedUser,
): Promise<StartedTrade> {
  await assertNoActiveTrade(prisma, user.id)

  const inviteToken = randomBytes(INVITE_TOKEN_BYTES).toString('base64url')

  const trade = await prisma.trade.create({
    data: {
      status: 'DRAFT',
      inviteToken,
      participants: { create: { userId: user.id, role: 'INITIATOR' } },
    },
    select: { id: true },
  })

  return { tradeId: trade.id, inviteToken }
}

/**
 * Entra numa troca pelo convite.
 *
 * É aqui que o consentimento fecha (regra 4.6.1): antes disto, nenhum dado
 * privado de nenhum dos dois foi cruzado. Depois, os dois lados se veem.
 *
 * O token é apagado na mesma transação em que a pessoa entra. Duas razões, e as
 * duas importam: um link que continua valendo é um link que ainda pode vazar, e
 * a regra 4.5 diz que um trade efetivo tem exatamente dois participantes — sem
 * apagar, o terceiro a abrir o link tentaria entrar numa troca cheia.
 */
export async function joinTrade(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  inviteToken: string,
): Promise<bigint> {
  await assertNoActiveTrade(prisma, user.id)

  const trade = await prisma.trade.findUnique({
    where: { inviteToken },
    select: { id: true, status: true, participants: { select: { userId: true } } },
  })

  if (!trade || trade.status !== 'DRAFT') {
    throw new NotFoundError('Este convite não vale mais.')
  }
  if (trade.participants.some((participant) => participant.userId === user.id)) {
    throw new ConflictError('JA_PARTICIPA', 'Você já está nesta troca.')
  }

  await prisma.$transaction(async (tx) => {
    /*
     * A condição no `updateMany` é o que resolve duas pessoas abrindo o mesmo
     * link ao mesmo tempo: quem chegar depois atualiza zero linhas, porque o
     * token já foi apagado, e desiste. Sem isso, as duas passariam pela
     * checagem acima e a troca terminaria com três participantes.
     */
    const claimed = await tx.trade.updateMany({
      where: { id: trade.id, inviteToken, status: 'DRAFT' },
      data: { inviteToken: null, status: 'NEGOTIATING' },
    })
    if (claimed.count === 0) throw new NotFoundError('Este convite não vale mais.')

    await tx.tradeParticipant.create({
      data: { tradeId: trade.id, userId: user.id, role: 'RECIPIENT' },
    })
  })

  return trade.id
}

/**
 * Uma troca ativa por vez (regra 4.5).
 *
 * É o que impede as mesmas cópias de serem comprometidas em várias trocas ao
 * mesmo tempo. `DRAFT` não conta: é um convite que ninguém aceitou.
 */
async function assertNoActiveTrade(prisma: PrismaClient, userId: bigint): Promise<void> {
  const active = await prisma.tradeParticipant.findFirst({
    where: { userId, trade: { status: { in: [...ACTIVE_TRADE_STATUSES] } } },
    select: { tradeId: true },
  })

  if (active) {
    throw new ConflictError(
      'TROCA_ATIVA',
      'Você já tem uma troca em andamento. Conclua ou cancele antes de começar outra.',
    )
  }
}

/**
 * Convida alguém da rede direto para uma troca (decisão 082).
 *
 * O convite por link continua para quem já conversa por fora; este é para quem
 * a pessoa achou na Social. A troca nasce em `DRAFT` com as **duas** pessoas, sem
 * link — ninguém de fora entra — e fica esperando a convidada aceitar. Até lá,
 * nenhum dado privado de nenhum dos dois é cruzado (regra 4.6.1): o consentimento
 * continua fechando no gesto de quem recebe.
 *
 * Um convite aberto por vez, como o link: quem convida tem de descartar o que já
 * mandou antes de mandar outro.
 */
export async function inviteMember(prisma: PrismaClient, user: AuthenticatedUser, username: string): Promise<bigint> {
  const eu = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { username: true } })
  if (!eu.username) {
    throw new ConflictError(
      'NOME_DE_USUARIO_NECESSARIO',
      'Escolha seu nome na rede em Minha conta antes de convidar: é ele que a outra pessoa vê.',
    )
  }

  const outra = await prisma.user.findUnique({
    where: { username: normalizeUsername(username) },
    select: { id: true, username: true, deletedAt: true },
  })
  if (!outra || outra.deletedAt || !outra.username) throw new NotFoundError('Ninguém na rede tem esse nome.')
  if (outra.id === user.id) throw new ValidationError('Você não pode convidar a si mesmo.')

  await assertNotBlocked(prisma, user.id, outra.id)
  await assertNoActiveTrade(prisma, user.id)

  const rascunho = await prisma.tradeParticipant.findFirst({
    where: { userId: user.id, role: 'INITIATOR', trade: { status: 'DRAFT' } },
    select: { tradeId: true },
  })
  if (rascunho) {
    throw new ConflictError(
      'CONVITE_ABERTO',
      'Você já tem um convite de troca aberto em Trocas. Descarte-o antes de convidar outra pessoa.',
    )
  }

  const trade = await prisma.trade.create({
    data: {
      status: 'DRAFT',
      participants: {
        create: [
          { userId: user.id, role: 'INITIATOR' },
          { userId: outra.id, role: 'RECIPIENT' },
        ],
      },
    },
    select: { id: true },
  })
  return trade.id
}

export interface ReceivedInvite {
  tradeId: string
  /** Quem convidou, pelo nome na rede. */
  fromUsername: string | null
  createdAt: Date
}

/** Os convites diretos que esta pessoa recebeu e ainda não respondeu. */
export async function listReceivedInvites(prisma: PrismaClient, user: AuthenticatedUser): Promise<ReceivedInvite[]> {
  const rows = await prisma.tradeParticipant.findMany({
    where: { userId: user.id, role: 'RECIPIENT', trade: { status: 'DRAFT', inviteToken: null } },
    select: {
      trade: {
        select: {
          id: true,
          createdAt: true,
          participants: { where: { role: 'INITIATOR' }, select: { user: { select: { username: true } } } },
        },
      },
    },
    orderBy: { id: 'desc' },
  })
  return rows.map((row) => ({
    tradeId: String(row.trade.id),
    fromUsername: row.trade.participants[0]?.user.username ?? null,
    createdAt: row.trade.createdAt,
  }))
}

async function convitePendente(prisma: PrismaClient, user: AuthenticatedUser, tradeId: bigint) {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    select: { status: true, inviteToken: true, participants: { select: { userId: true, role: true } } },
  })
  const eu = trade?.participants.find((p) => p.userId === user.id)
  if (!trade || !eu || eu.role !== 'RECIPIENT' || trade.status !== 'DRAFT' || trade.inviteToken !== null) {
    throw new NotFoundError('Este convite não vale mais.')
  }
  return { quemConvidou: trade.participants.find((p) => p.role === 'INITIATOR')!.userId }
}

/**
 * Aceita o convite: é aqui que o consentimento fecha, e a troca vira negociação.
 *
 * As duas pessoas precisam estar livres de outra troca ativa (regra 4.5) — quem
 * convidou pode ter começado outra enquanto o convite esperava.
 */
export async function acceptInvite(prisma: PrismaClient, user: AuthenticatedUser, tradeId: bigint): Promise<bigint> {
  const { quemConvidou } = await convitePendente(prisma, user, tradeId)
  await assertNotBlocked(prisma, user.id, quemConvidou)
  await assertNoActiveTrade(prisma, user.id)

  const ocupada = await prisma.tradeParticipant.findFirst({
    where: { userId: quemConvidou, trade: { status: { in: [...ACTIVE_TRADE_STATUSES] } } },
    select: { tradeId: true },
  })
  if (ocupada) {
    throw new ConflictError('TROCA_ATIVA_DO_OUTRO', 'Quem convidou já está em outra troca. Tente de novo mais tarde.')
  }

  // A condicao no `updateMany` resolve aceitar duas vezes ao mesmo tempo, ou
  // aceitar enquanto quem convidou descarta: quem chegar depois nao muda nada.
  const aceito = await prisma.trade.updateMany({
    where: { id: tradeId, status: 'DRAFT', inviteToken: null },
    data: { status: 'NEGOTIATING' },
  })
  if (aceito.count === 0) throw new NotFoundError('Este convite não vale mais.')
  return tradeId
}

/** Recusa o convite. A troca é cancelada, e some de Trocas para os dois. */
export async function declineInvite(prisma: PrismaClient, user: AuthenticatedUser, tradeId: bigint): Promise<void> {
  await convitePendente(prisma, user, tradeId)
  await prisma.trade.updateMany({
    where: { id: tradeId, status: 'DRAFT', inviteToken: null },
    data: { status: 'CANCELLED' },
  })
}

/** Bloqueio em qualquer direção impede o convite (regra 6.1.4, como nas conversas). */
async function assertNotBlocked(prisma: PrismaClient, a: bigint, b: bigint): Promise<void> {
  const bloqueio = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  })
  if (bloqueio) throw new AuthorizationError('Não é possível convidar esta pessoa para uma troca.')
}
