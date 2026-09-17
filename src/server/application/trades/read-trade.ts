import type { PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { AuthorizationError, NotFoundError } from '@/server/domain/errors'
import { compareCatalogOrder, placementSet, type CatalogOrderKey } from '@/server/domain/catalog/order'
import { crossTrade, notWantedOffer, type CrossedCard, type TradeSide } from '@/server/domain/trades/crossing'
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
  /**
   * Esta pessoa marcou que as cartas trocaram de mão.
   *
   * Diferente de `confirmed`: confirmar é concordar com a oferta, marcar é dizer
   * que o encontro aconteceu. A troca só conclui quando os dois marcam
   * (decisão 062).
   */
  exchanged: boolean
  /** O que esta pessoa colocou na oferta. */
  offer: TradeCardOffer[]
}

/**
 * Uma sugestão do cruzamento, com a carta que a tela precisa desenhar.
 *
 * O domínio devolve só ids — ele é aritmética, e não sabe o que é uma carta. É
 * aqui que os dois se juntam, uma vez, em vez de a tela pedir a carta de cada
 * sugestão depois.
 */
export interface TradeSuggestion extends CrossedCard {
  cardCode: string
  cardName: string
  imageUrl: string | null
}

export interface TradeView {
  tradeId: string
  status: TradeStatus
  /** O link de convite, enquanto ainda falta alguém entrar. */
  inviteToken: string | null
  /** Quem foi convidado direto e ainda não aceitou (decisão 082). */
  invitedUsername: string | null
  me: TradeSideView
  /** Nulo enquanto o convite não foi aceito: não há outro lado ainda. */
  other: TradeSideView | null
  /** O que eu tenho e a outra pessoa quer. Sugestão, nunca obrigação. Na ordem do catálogo. */
  iCanOffer: TradeSuggestion[]
  /**
   * O resto do meu Trade Binder: o que a outra pessoa não procura, e que eu
   * posso oferecer mesmo assim (decisão 083). Na ordem do catálogo.
   */
  iCanAlsoOffer: TradeSuggestion[]
  /** O que a outra pessoa tem e eu quero. */
  theyCanOffer: TradeSuggestion[]
  /** Os dois confirmaram: a troca está validada. */
  validated: boolean
  /** Quando a troca foi concluída. Nulo enquanto ela não foi. */
  completedAt: Date | null
  /**
   * Quando a oferta mudou pela última vez (decisão 065).
   *
   * A tela conta os cinco segundos a partir daqui. Quem **aplica** a espera é o
   * servidor, em `confirmTrade` — este campo existe para a pessoa ver quanto
   * falta, e não para decidir.
   */
  offerChangedAt: Date | null
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
      completedAt: true,
      offerChangedAt: true,
      participants: {
        select: {
          id: true,
          userId: true,
          role: true,
          confirmedAt: true,
          reviewRequestedAt: true,
          exchangedAt: true,
          user: { select: { name: true, username: true } },
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

  /*
   * O convite direto que ainda nao foi aceito (decisao 082). A convidada nao ve a
   * troca antes de aceitar, e quem convidou nao ve o cruzamento com ela: o
   * consentimento da regra 4.6.1 fecha no aceite, e antes dele nenhum dado
   * privado de nenhum dos dois e cruzado.
   */
  const pendente = trade.status === 'DRAFT'
  if (pendente && mine.role === 'RECIPIENT') {
    throw new AuthorizationError('Aceite o convite em Trocas para ver a troca.')
  }
  const convidada = pendente ? trade.participants.find((p) => p.role === 'RECIPIENT') : undefined
  const theirs = pendente ? undefined : trade.participants.find((participant) => participant.userId !== user.id)

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

  // O resto do que eu tenho: oferecido com uma copia, e sem "procura".
  const resto: CrossedCard[] = notWantedOffer(myData.available, crossing.fromFirst).map((card) => ({
    variantId: card.variantId,
    quantity: 1,
    available: card.quantity,
    stillWanted: 0,
  }))

  const cartas = await cardsByVariant(prisma, [
    ...crossing.fromFirst.map((c) => c.variantId),
    ...crossing.fromSecond.map((c) => c.variantId),
    ...resto.map((c) => c.variantId),
  ])

  return {
    tradeId: String(trade.id),
    status: trade.status as TradeStatus,
    inviteToken: trade.inviteToken,
    invitedUsername: convidada?.user.username ?? null,
    me: toSideView(mine),
    other: theirs ? toSideView(theirs) : null,
    iCanOffer: withCards(crossing.fromFirst, cartas),
    iCanAlsoOffer: withCards(resto, cartas),
    theyCanOffer: withCards(crossing.fromSecond, cartas),
    validated: isValidated(participants),
    completedAt: trade.completedAt,
    offerChangedAt: trade.offerChangedAt,
  }
}

/**
 * Como a outra pessoa aparece: pelo nome na rede quando há, que é a única
 * identidade que outros veem (regra 6.1.1). O nome real fica para a troca por
 * link com quem ainda não escolheu nome — que já se conhece por fora.
 */
export function displayName(user: { name: string; username: string | null }): string {
  return user.username ? `@${user.username}` : user.name
}

type CardLabel = { cardCode: string; cardName: string; imageUrl: string | null; order: CatalogOrderKey }

/**
 * As cartas das sugestões, numa consulta só.
 *
 * Uma por sugestão daria dezenas de idas ao banco para desenhar uma tela.
 */
async function cardsByVariant(
  prisma: PrismaClient,
  variantIds: readonly string[],
): Promise<Map<string, CardLabel>> {
  const ids = [...new Set(variantIds)].map((id) => BigInt(id))
  if (ids.length === 0) return new Map()

  const rows = await prisma.cardVariant.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      sourceId: true,
      imageUrl: true,
      card: { select: { code: true, name: true } },
      printings: { select: { set: { select: { code: true } } } },
    },
  })

  return new Map(
    rows.map((row) => [
      String(row.id),
      {
        cardCode: row.card.code,
        cardName: row.card.name,
        imageUrl: row.imageUrl,
        order: {
          cardCode: row.card.code,
          sourceId: row.sourceId,
          setCode: placementSet(row.card.code, row.printings.map((p) => p.set.code)),
        },
      },
    ]),
  )
}

/**
 * Junta a aritmética com a carta, descarta o que não tem carta, e ordena como o
 * catálogo: coleção e número (decisões 040, 069 e 083).
 *
 * Uma sugestão sem carta não existe: a variante teria de ter saído do catálogo
 * entre uma consulta e outra. Mostrar um id cru seria pior que não mostrar.
 */
function withCards(
  crossed: readonly CrossedCard[],
  cards: Map<string, CardLabel>,
): TradeSuggestion[] {
  return crossed
    .flatMap((item) => {
      const card = cards.get(item.variantId)
      return card ? [{ item, card }] : []
    })
    .sort((a, b) => compareCatalogOrder(a.card.order, b.card.order) || (a.item.variantId < b.item.variantId ? -1 : 1))
    .map(({ item, card }) => ({
      ...item,
      cardCode: card.cardCode,
      cardName: card.cardName,
      imageUrl: card.imageUrl,
    }))
}

type ParticipantRow = {
  userId: bigint
  confirmedAt: Date | null
  reviewRequestedAt: Date | null
  exchangedAt: Date | null
  user: { name: string; username: string | null }
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
    name: displayName(participant.user),
    confirmed: participant.confirmedAt !== null,
    reviewRequested: participant.reviewRequestedAt !== null,
    exchanged: participant.exchangedAt !== null,
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

export interface OpenTrade {
  tradeId: string
  status: TradeStatus
  /** O nome de quem está do outro lado, ou nulo enquanto o convite não foi aceito. */
  otherName: string | null
  /** O convite, enquanto ainda falta alguém entrar. */
  inviteToken: string | null
  /** Quem foi convidado direto e ainda não aceitou (decisão 082). */
  invitedUsername: string | null
  /** A outra pessoa alterou depois de eu confirmar. */
  reviewRequested: boolean
  /** Eu já marquei que as cartas trocaram de mão. */
  exchanged: boolean
}

/**
 * A troca que esta pessoa tem aberta, ou nula.
 *
 * Uma por vez: a regra 4.5 permite um trade ativo, e o rascunho — o convite que
 * ninguém aceitou ainda — é o único que pode coexistir com ele. Quando os dois
 * existirem, vale o ativo: é o que tem alguém do outro lado esperando.
 *
 * Serve à tela de Trocas, que precisa decidir entre "começar uma troca" e
 * "continuar a que está aberta" antes de desenhar qualquer coisa.
 */
export async function getOpenTrade(
  prisma: PrismaClient,
  user: AuthenticatedUser,
): Promise<OpenTrade | null> {
  const participacoes = await prisma.tradeParticipant.findMany({
    where: {
      userId: user.id,
      trade: { status: { in: ['DRAFT', 'PROPOSED', 'NEGOTIATING', 'CONFIRMED'] } },
      // O convite direto recebido nao e troca aberta de quem recebeu: e pergunta,
      // e aparece na lista de convites (decisao 082).
      NOT: { role: 'RECIPIENT', trade: { status: 'DRAFT' } },
    },
    select: {
      reviewRequestedAt: true,
      exchangedAt: true,
      trade: {
        select: {
          id: true,
          status: true,
          inviteToken: true,
          participants: { select: { userId: true, role: true, user: { select: { name: true, username: true } } } },
        },
      },
    },
    orderBy: { id: 'desc' },
  })
  if (participacoes.length === 0) return null

  const escolhida =
    participacoes.find((p) => p.trade.status !== 'DRAFT') ?? participacoes[0]
  const outro = escolhida.trade.participants.find((p) => p.userId !== user.id)

  return {
    tradeId: String(escolhida.trade.id),
    status: escolhida.trade.status as TradeStatus,
    // No rascunho ninguem entrou ainda: a convidada aparece como convidada, e nao como "o outro lado".
    otherName: outro && escolhida.trade.status !== 'DRAFT' ? displayName(outro.user) : null,
    inviteToken: escolhida.trade.inviteToken,
    invitedUsername:
      escolhida.trade.status === 'DRAFT' ? (outro?.role === 'RECIPIENT' ? outro.user.username : null) : null,
    reviewRequested: escolhida.reviewRequestedAt !== null,
    exchanged: escolhida.exchangedAt !== null,
  }
}
