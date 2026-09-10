import type { Prisma, PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { AuthorizationError, ConflictError, NotFoundError } from '@/server/domain/errors'
import {
  acceptsChanges,
  isValidated,
  statusAfterChange,
  type TradeStatus,
} from '@/server/domain/trades/negotiation'

/**
 * Alterar a própria oferta e confirmar a troca.
 *
 * Camada: application.
 *
 * ## Cada um mexe só na própria oferta
 *
 * A regra 4.6.2, e o servidor é quem garante. Nenhuma destas funções recebe um
 * `trade_participant_id`: elas recebem o trade e o usuário autenticado, e
 * descobrem sozinhas qual participante é ele. Um id vindo do cliente nunca é
 * confiável (regra 6.2), e receber um seria abrir a porta para alguém editar a
 * oferta do outro passando o id errado de propósito.
 *
 * ## Qualquer alteração revoga as confirmações
 *
 * As duas, e não só a de quem não alterou (regra 4.6.3). Uma confirmação
 * significa "concordo com a troca que está na tela agora"; se sobrevivesse a
 * uma alteração, ninguém saberia se o outro concordou com o que vê ou com uma
 * versão anterior.
 *
 * Isso acontece na **mesma transação** da alteração. Fora dela, existiria um
 * instante em que a troca está alterada e ainda confirmada — e é justamente
 * nesse instante que alguém poderia concluí-la.
 */

export interface OfferChange {
  cardVariantId: bigint
  /** Zero remove a carta da oferta. */
  quantity: number
}

/**
 * Põe, muda ou tira uma carta da própria oferta.
 *
 * Quantidade zero remove: é o mesmo gesto de "não quero mais oferecer esta", e
 * um caminho separado para remover daria duas formas de dizer a mesma coisa.
 */
export async function setOfferItem(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  tradeId: bigint,
  change: OfferChange,
): Promise<void> {
  if (change.quantity < 0) {
    throw new ConflictError('QUANTIDADE_INVALIDA', 'A quantidade precisa ser zero ou mais.')
  }

  await prisma.$transaction(async (tx) => {
    const { trade, participantId } = await requireParticipant(tx, user, tradeId)

    if (!acceptsChanges(trade.status)) {
      throw new ConflictError('TROCA_ENCERRADA', 'Esta troca não aceita mais alterações.')
    }

    if (change.quantity === 0) {
      await tx.tradeItem.deleteMany({
        where: { tradeParticipantId: participantId, cardVariantId: change.cardVariantId },
      })
    } else {
      await tx.tradeItem.upsert({
        where: {
          tradeParticipantId_cardVariantId: {
            tradeParticipantId: participantId,
            cardVariantId: change.cardVariantId,
          },
        },
        create: {
          tradeParticipantId: participantId,
          cardVariantId: change.cardVariantId,
          quantity: change.quantity,
        },
        update: { quantity: change.quantity },
      })
    }

    await revokeAll(tx, tradeId, trade.status, user.id)
  })
}

/**
 * Confirma a troca como ela está.
 *
 * Quando o segundo confirma, o trade vai a `CONFIRMED`: os dois estão de acordo
 * com o mesmo estado. A conclusão — mover as cópias de verdade — é outro caso
 * de uso, e depende da regra 4.6 sobre de onde as cartas saem.
 */
export async function confirmTrade(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  tradeId: bigint,
): Promise<{ validated: boolean }> {
  return prisma.$transaction(async (tx) => {
    const { trade, participantId } = await requireParticipant(tx, user, tradeId)

    if (!acceptsChanges(trade.status)) {
      throw new ConflictError('TROCA_ENCERRADA', 'Esta troca não aceita mais alterações.')
    }
    if (trade.participants.length !== 2) {
      throw new ConflictError(
        'TROCA_INCOMPLETA',
        'A troca precisa das duas pessoas para ser confirmada.',
      )
    }

    // Confirmar encerra o pedido de revisao: a pessoa viu o que mudou e topou.
    await tx.tradeParticipant.update({
      where: { id: participantId },
      data: { confirmedAt: new Date(), reviewRequestedAt: null },
    })

    const participants = await tx.tradeParticipant.findMany({
      where: { tradeId },
      select: { userId: true, confirmedAt: true },
    })

    const validated = isValidated(participants)
    if (validated) {
      await tx.trade.update({ where: { id: tradeId }, data: { status: 'CONFIRMED' } })
    }

    return { validated }
  })
}

/**
 * Retira a própria confirmação, sem alterar a oferta.
 *
 * Existe porque mudar de ideia não deveria exigir mexer nas cartas só para
 * derrubar a confirmação. O efeito no trade é o mesmo de uma alteração.
 */
export async function withdrawConfirmation(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  tradeId: bigint,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const { trade, participantId } = await requireParticipant(tx, user, tradeId)

    if (!acceptsChanges(trade.status)) {
      throw new ConflictError('TROCA_ENCERRADA', 'Esta troca não aceita mais alterações.')
    }

    /*
     * As duas marcacoes caem, e nao so a de quem retirou. Sem isto, retirar a
     * confirmacao e confirmar de novo concluiria a troca no mesmo instante,
     * usando uma marcacao que o outro deu para um combinado que voce acabou de
     * desfazer e refazer.
     */
    await clearExchangeMarks(tx, tradeId)

    await tx.tradeParticipant.update({
      where: { id: participantId },
      data: { confirmedAt: null },
    })
    await tx.trade.update({
      where: { id: tradeId },
      data: { status: statusAfterChange(trade.status) },
    })
  })
}

/** Cancela a troca. Qualquer um dos dois pode, e a qualquer momento antes do fim. */
export async function cancelTrade(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  tradeId: bigint,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const { trade } = await requireParticipant(tx, user, tradeId)

    if (!acceptsChanges(trade.status)) {
      throw new ConflictError('TROCA_ENCERRADA', 'Esta troca já terminou.')
    }

    await tx.trade.update({
      where: { id: tradeId },
      data: { status: 'CANCELLED', inviteToken: null },
    })
  })
}

/**
 * Quem pergunta participa desta troca?
 *
 * Devolve o `trade_participant_id` **dele**, que é o único que qualquer destas
 * operações vai tocar. É aqui que a regra 4.6.2 deixa de ser intenção e vira
 * garantia.
 */
async function requireParticipant(
  tx: Prisma.TransactionClient,
  user: AuthenticatedUser,
  tradeId: bigint,
): Promise<{
  trade: { status: TradeStatus; participants: { userId: bigint }[] }
  participantId: bigint
}> {
  const trade = await tx.trade.findUnique({
    where: { id: tradeId },
    select: { status: true, participants: { select: { id: true, userId: true } } },
  })
  if (!trade) throw new NotFoundError('Troca não encontrada.')

  const mine = trade.participants.find((participant) => participant.userId === user.id)
  if (!mine) throw new AuthorizationError('Você não participa desta troca.')

  return {
    trade: {
      status: trade.status as TradeStatus,
      participants: trade.participants.map((p) => ({ userId: p.userId })),
    },
    participantId: mine.id,
  }
}

/**
 * Derruba as confirmações e pede revisão a quem não alterou.
 *
 * As duas coisas na mesma transação da alteração. Fora dela existiria um
 * instante em que a troca está alterada e ainda confirmada — e é justamente
 * nesse instante que alguém poderia concluí-la.
 *
 * **Quem alterou não recebe pedido de revisão.** Ele sabe o que fez; a
 * confirmação dele cai do mesmo jeito, mas mandá-lo revisar o próprio gesto
 * seria ruído — e ruído num aviso é o que faz o aviso deixar de ser lido.
 */
async function revokeAll(
  tx: Prisma.TransactionClient,
  tradeId: bigint,
  status: TradeStatus,
  changedBy: bigint,
): Promise<void> {
  const agora = new Date()

  await clearExchangeMarks(tx, tradeId)

  await tx.tradeParticipant.updateMany({
    where: { tradeId, userId: { not: changedBy }, confirmedAt: { not: null } },
    data: { confirmedAt: null, reviewRequestedAt: agora },
  })

  await tx.tradeParticipant.updateMany({
    where: { tradeId, userId: changedBy },
    data: { confirmedAt: null },
  })

  const next = statusAfterChange(status)
  if (next !== status) {
    await tx.trade.update({ where: { id: tradeId }, data: { status: next } })
  }
}

/**
 * Apaga as marcações de "já trocamos" e as origens que vieram com elas.
 *
 * É a regra 4.6.3 levada até o fim. Uma marcação diz "as cartas que estão na
 * tela mudaram de dono"; se o combinado deixou de valer, ela fala de uma troca
 * que não existe mais — exatamente como a confirmação que ela sucede.
 *
 * Vale para as **duas**, e não só para a de quem não mexeu, pelo mesmo motivo
 * que a confirmação: quem marcou e em seguida alterou não marcou esta troca.
 *
 * As origens vão junto porque descrevem a oferta anterior. Deixá-las seria
 * guardar "estas duas cópias saem do Binder A" sobre um item que agora tem
 * outra quantidade — e a conclusão as revalidaria contra a oferta errada.
 *
 * O `CHECK` do banco garante que isto nunca seja esquecido: marcação sem
 * confirmação é recusada na escrita.
 */
async function clearExchangeMarks(
  tx: Prisma.TransactionClient,
  tradeId: bigint,
): Promise<void> {
  await tx.tradeItemOrigin.deleteMany({
    where: { tradeItem: { tradeParticipant: { tradeId } } },
  })
  await tx.tradeParticipant.updateMany({
    where: { tradeId, exchangedAt: { not: null } },
    data: { exchangedAt: null },
  })
}
