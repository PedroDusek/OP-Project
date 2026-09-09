import type { PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { AuthorizationError, NotFoundError } from '@/server/domain/errors'
import { crossTrade, type CrossedCard, type TradeSide } from '@/server/domain/trades/crossing'
import { isValidated, type TradeStatus } from '@/server/domain/trades/negotiation'

/**
 * Ler uma troca, já cruzada nas duas direções.
 *
 * Camada: application.
 *
 * ## Ninguém de fora lê nada
 *
 * A primeira coisa que esta função faz é conferir se quem pergunta é
 * participante. Não é detalhe de implementação: é a regra 6.2, e é o que
 * sustenta a promessa da 4.6.1 — o dado privado dos dois só se cruza porque as
 * duas pessoas entraram na troca.
 *
 * ## Os dois lados, do ponto de vista de quem lê
 *
 * A tela é sempre "eu" e "a outra pessoa", nunca "participante 1" e
 * "participante 2". Quem lê precisa saber o que **está oferecendo** e o que
 * **vai receber**, e essa orientação depende de quem está olhando.
 */

export interface TradeCardOffer {
  variantId: string
  cardCode: string
  cardName: string
  imageUrl: string | null
  rarity: string | null
  variantType: string
  quantity: number
}

export interface TradeSideView {
  userId: string
  name: string
  confirmed: boolean
  /**
   * A outra pessoa alterou a troca depois desta ter confirmado.
   *
   * É o aviso da regra 4.6.3. Só aparece para quem tinha confirmado: quem
   * alterou sabe o que fez.
   */
  reviewRequested: boolean
  /** O que esta pessoa colocou na oferta. */
  offer: TradeCardOffer[]
}

export interface TradeView {
  tradeId: string
  status: TradeStatus
  /** O link de convite, enquanto ainda falta alguém entrar. */
  inviteToken: string | null
  me: TradeSideView
  /** Nulo enquanto o convite não foi aceito: não há outro lado ainda. */
  other: TradeSideView | null
  /** O que eu tenho e a outra pessoa quer. Sugestão, nunca obrigação. */
  iCanOffer: CrossedCard[]
  /** O que a outra pessoa tem e eu quero. */
  theyCanOffer: CrossedCard[]
  /** Os dois confirmaram: a troca está validada. */
  validated: boolean
}

export async function getTrade(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  tradeId: bigint,
): Promise<TradeView> {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    select: {
      id: true,
      status: true,
      inviteToken: true,
      participants: {
        select: {
          id: true,
          userId: true,
          confirmedAt: true,
          reviewRequestedAt: true,
          user: { select: { name: true } },
          items: {
            select: {
              quantity: true,
              cardVariant: {
                select: {
                  id: true,
                  rarity: true,
                  variantType: true,
                  imageUrl: true,
                  card: { select: { code: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!trade) throw new NotFoundError('Troca não encontrada.')

  const mine = trade.participants.find((participant) => participant.userId === user.id)
  if (!mine) {
    // Quem não está na troca não recebe "não encontrada": a diferença entre as
    // duas respostas contaria a estranhos que aquela troca existe.
    throw new AuthorizationError('Você não participa desta troca.')
  }

  const theirs = trade.participants.find((participant) => participant.userId !== user.id)

  const [myData, theirData] = await Promise.all([
    tradeSideData(prisma, user.id),
    theirs ? tradeSideData(prisma, theirs.userId) : null,
  ])

  const crossing =
    theirData !== null
      ? crossTrade(myData, theirData)
      : { fromFirst: [], fromSecond: [] }

  const participants = trade.participants.map((participant) => ({
    userId: participant.userId,
    confirmedAt: participant.confirmedAt,
  }))

  return {
    tradeId: String(trade.id),
    status: trade.status as TradeStatus,
    inviteToken: trade.inviteToken,
    me: toSideView(mine),
    other: theirs ? toSideView(theirs) : null,
    iCanOffer: crossing.fromFirst,
    theyCanOffer: crossing.fromSecond,
    validated: isValidated(participants),
  }
}

type ParticipantRow = {
  userId: bigint
  confirmedAt: Date | null
  reviewRequestedAt: Date | null
  user: { name: string }
  items: {
    quantity: number
    cardVariant: {
      id: bigint
      rarity: string | null
      variantType: string
      imageUrl: string | null
      card: { code: string; name: string }
    }
  }[]
}

function toSideView(participant: ParticipantRow): TradeSideView {
  return {
    userId: String(participant.userId),
    name: participant.user.name,
    confirmed: participant.confirmedAt !== null,
    reviewRequested: participant.reviewRequestedAt !== null,
    offer: participant.items.map((item) => ({
      variantId: String(item.cardVariant.id),
      cardCode: item.cardVariant.card.code,
      cardName: item.cardVariant.card.name,
      imageUrl: item.cardVariant.imageUrl,
      rarity: item.cardVariant.rarity,
      variantType: item.cardVariant.variantType,
      quantity: item.quantity,
    })),
  }
}

/**
 * O que uma pessoa tem disponível e o que ela quer.
 *
 * Lido por `userId`, e não pelo `AuthenticatedUser`, porque um dos dois lados é
 * sempre de outra pessoa — e chegar aqui já significa que ela consentiu, ao
 * entrar na troca. A autorização acontece uma vez, em `getTrade`, e não se
 * repete a cada consulta: repetir espalharia a decisão por vários lugares que
 * podem discordar.
 */
async function tradeSideData(prisma: PrismaClient, userId: bigint): Promise<TradeSide> {
  const [allocations, wants] = await Promise.all([
    prisma.collectionItemLocation.findMany({
      where: { storageLocation: { userId, purpose: 'TRADE' } },
      select: { quantity: true, collectionItem: { select: { cardVariantId: true } } },
    }),
    prisma.wantItem.findMany({
      where: { userId },
      select: {
        cardVariantId: true,
        quantity: true,
        cardVariant: {
          select: { collectionItems: { where: { collection: { userId } }, select: { quantity: true } } },
        },
      },
    }),
  ])

  const availableByVariant = new Map<string, number>()
  for (const row of allocations) {
    const key = String(row.collectionItem.cardVariantId)
    availableByVariant.set(key, (availableByVariant.get(key) ?? 0) + row.quantity)
  }

  return {
    available: [...availableByVariant].map(([variantId, quantity]) => ({ variantId, quantity })),
    wanted: wants.map((want) => ({
      variantId: String(want.cardVariantId),
      wanted: want.quantity,
      owned: want.cardVariant.collectionItems[0]?.quantity ?? 0,
    })),
  }
}
