import { randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { ConflictError, NotFoundError } from '@/server/domain/errors'
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
