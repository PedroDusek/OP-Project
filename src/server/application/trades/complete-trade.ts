import { Prisma, type PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { AuthorizationError, ConflictError, NotFoundError } from '@/server/domain/errors'
import type { Allocation, Removal } from '@/server/domain/storage/allocation'
import {
  bothMarkedExchange,
  canMarkExchange,
  collectionDeltas,
  planOrigin,
  type CollectionDelta,
  type OfferedCard,
  type OriginProblem,
} from '@/server/domain/trades/completion'
import type { TradeStatus } from '@/server/domain/trades/negotiation'

/**
 * Concluir uma troca: marcar que ela aconteceu e mover as cópias de verdade.
 *
 * Camada: application.
 *
 * ## Dois gestos, um efeito
 *
 * Confirmar é concordar com a oferta; marcar é dizer que as cartas mudaram de
 * dono. **Os dois marcam** (decisão 062), e a troca só conclui quando o segundo
 * marca — antes disso nada se move. Ninguém tem a coleção alterada sem o
 * próprio gesto, e cada um responde pelas próprias cópias à pergunta da regra
 * 4.6 sobre de onde elas saem.
 *
 * ## A janela entre as duas marcações
 *
 * Quem marca primeiro responde hoje; a transação roda quando o outro marcar. A
 * resposta fica em `trade_item_origins` nesse meio-tempo — e é **revalidada** na
 * conclusão, porque entre uma marcação e outra a pessoa pode ter tirado a carta
 * do binder. A regra 4.7 já manda conferir a disponibilidade na hora de
 * concluir; conferir a origem junto é a mesma frase levada a sério.
 *
 * ## Tudo ou nada
 *
 * A conclusão inteira acontece numa transação (regra 4.7). Um trade nunca fica
 * meio concluído: se qualquer etapa falhar, nada se moveu.
 *
 * ## A ordem das escritas não é estética
 *
 * Primeiro sai do local de troca, depois a coleção anda. O banco tem um trigger
 * que recusa reduzir a quantidade possuída abaixo do que está alocado, e um
 * `CHECK` que proíbe `quantity` zero. Reduzir antes de desalocar bateria no
 * trigger; deixar a linha em zero bateria no `CHECK`. A ordem daqui é a única
 * que nunca visita um estado que o banco recusa.
 */

/** De quais locais de troca saem as cópias de uma carta, escolhido pela pessoa. */
export interface OriginChoice {
  cardVariantId: bigint
  removals: Removal[]
}

/** A pessoa precisa dizer de onde as cópias saem antes de marcar (regra 4.6). */
export const ORIGIN_CHOICE_REQUIRED = 'ORIGEM_A_ESCOLHER'

/** Um local de troca que guarda a carta, para a tela montar a pergunta. */
export interface OriginLocation {
  storageLocationId: string
  storageName: string
  quantity: number
}

/** Uma carta da oferta cuja origem tem mais de uma resposta possível. */
export interface OriginQuestion {
  variantId: string
  cardCode: string
  cardName: string
  imageUrl: string | null
  /** Quantas cópias saem ao todo. A soma da escolha precisa bater com isto. */
  offered: number
  locations: OriginLocation[]
}

export interface MarkExchangeResult {
  /** Os dois marcaram e a troca foi concluída agora. */
  completed: boolean
}

/**
 * Marca que as cartas trocaram de mão, e conclui se o outro já tinha marcado.
 *
 * A escolha de origem chega junto e é aplicada na mesma chamada, pelo mesmo
 * motivo da decisão 007: separar em duas idas deixaria uma janela com a marcação
 * dada e a origem indefinida.
 */
export async function markExchange(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  tradeId: bigint,
  choices: readonly OriginChoice[] = [],
): Promise<MarkExchangeResult> {
  return prisma.$transaction(async (tx) => {
    const trade = await lockTrade(tx, tradeId)

    const mine = trade.participants.find((participant) => participant.userId === user.id)
    if (!mine) throw new AuthorizationError('Você não participa desta troca.')

    if (!canMarkExchange(trade.status)) {
      throw new ConflictError(
        'TROCA_NAO_CONFIRMADA',
        'A troca precisa estar confirmada pelos dois antes de ser marcada como feita.',
      )
    }

    const chosenByVariant = new Map(
      choices.map((choice) => [String(choice.cardVariantId), choice.removals]),
    )

    const stock = await tradeStock(
      tx,
      mine.userId,
      mine.items.map((item) => item.cardVariantId),
    )

    const planned: { itemId: bigint; removals: Removal[] }[] = []
    const questions: bigint[] = []

    for (const item of mine.items) {
      const key = String(item.cardVariantId)
      const plan = planOrigin(
        item.quantity,
        stock.get(key)?.allocations ?? [],
        chosenByVariant.get(key) ?? [],
      )

      if (plan.ok) {
        planned.push({ itemId: item.id, removals: plan.removals })
        continue
      }

      if (plan.reason === 'ESCOLHA_NECESSARIA') {
        questions.push(item.cardVariantId)
        continue
      }

      throw new ConflictError(originProblemCode(plan.reason), originProblemMessage(plan.reason))
    }

    if (questions.length > 0) {
      throw new ConflictError(
        ORIGIN_CHOICE_REQUIRED,
        'Algumas cartas estão em mais de um local de troca. Diga de onde as cópias saem.',
        { cards: await describeQuestions(tx, mine.items, stock, questions) },
      )
    }

    /*
     * A origem e a marcacao gravam juntas, e a origem anterior e reescrita
     * inteira. A escolha de antes nao vale para a oferta de agora, e descobrir o
     * que mudou custaria mais para ler do que apagar e regravar um punhado de
     * linhas.
     */
    await tx.tradeItemOrigin.deleteMany({
      where: { tradeItem: { tradeParticipantId: mine.id } },
    })

    const rows = planned.flatMap((plan) =>
      plan.removals.map((removal) => ({
        tradeItemId: plan.itemId,
        storageLocationId: BigInt(removal.storageLocationId),
        quantity: removal.quantity,
      })),
    )
    if (rows.length > 0) await tx.tradeItemOrigin.createMany({ data: rows })

    await tx.tradeParticipant.update({
      where: { id: mine.id },
      data: { exchangedAt: new Date() },
    })

    const marks = await tx.tradeParticipant.findMany({
      where: { tradeId },
      select: { userId: true, exchangedAt: true },
    })

    if (!bothMarkedExchange(marks)) return { completed: false }

    await completeTrade(tx, tradeId)
    return { completed: true }
  })
}

/**
 * Retira a própria marcação, sem desfazer a confirmação.
 *
 * Existe pelo mesmo motivo que `withdrawConfirmation`: mudar de ideia não
 * deveria exigir cancelar a troca. E existe por um segundo motivo, mais
 * concreto — se as cópias saíram do binder de troca depois da marcação, a origem
 * guardada deixa de fechar e a conclusão passa a recusar. Retirar e marcar de
 * novo é a saída, e sem isto não haveria nenhuma.
 */
export async function withdrawExchange(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  tradeId: bigint,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const trade = await lockTrade(tx, tradeId)

    const mine = trade.participants.find((participant) => participant.userId === user.id)
    if (!mine) throw new AuthorizationError('Você não participa desta troca.')

    if (trade.status === 'COMPLETED' || trade.status === 'CANCELLED') {
      throw new ConflictError('TROCA_ENCERRADA', 'Esta troca já terminou.')
    }

    await tx.tradeItemOrigin.deleteMany({
      where: { tradeItem: { tradeParticipantId: mine.id } },
    })
    await tx.tradeParticipant.update({ where: { id: mine.id }, data: { exchangedAt: null } })
  })
}

/**
 * Move as cópias e fecha a troca. Só roda dentro da transação da segunda
 * marcação.
 *
 * As sete verificações da regra 4.7 acontecem aqui, e **todas antes de qualquer
 * escrita**: validar depois de já ter movido metade seria deixar para o rollback
 * uma coisa que dá para não deixar acontecer.
 */
async function completeTrade(tx: Prisma.TransactionClient, tradeId: bigint): Promise<void> {
  const trade = await tx.trade.findUniqueOrThrow({
    where: { id: tradeId },
    select: {
      participants: {
        select: {
          id: true,
          userId: true,
          items: {
            select: {
              id: true,
              cardVariantId: true,
              quantity: true,
              origins: { select: { storageLocationId: true, quantity: true } },
            },
          },
        },
      },
    },
  })

  // Item 1: exatamente dois participantes.
  if (trade.participants.length !== 2) {
    throw new ConflictError('TROCA_INCOMPLETA', 'A troca precisa das duas pessoas.')
  }

  // Item 2: o trade possui itens. "O trade", e nao "cada lado": a regra fala da
  // troca inteira, e dar uma carta sem receber nada e um acerto legitimo entre
  // duas pessoas que sabem o que combinaram.
  const items = trade.participants.reduce((sum, side) => sum + side.items.length, 0)
  if (items === 0) throw new ConflictError('TROCA_VAZIA', 'Não há nada para trocar.')

  const [first, second] = trade.participants

  /*
   * Os dois lados sao planejados em sequencia, e nao em paralelo. Cada um trava
   * linhas da colecao com FOR UPDATE, e duas travas concorrentes dentro da mesma
   * transacao nao ganham nada — o Prisma serializa a transacao de qualquer jeito.
   */
  const sides = [await planSide(tx, first, second), await planSide(tx, second, first)]

  // Primeiro sai do local de troca. Reduzir a colecao antes bateria no trigger
  // que impede deixar alocacao orfa (item 6 da regra 4.7).
  for (const side of sides) {
    for (const removal of side.removals) {
      const remaining = removal.held - removal.quantity
      const where = {
        collectionItemId_storageLocationId: {
          collectionItemId: removal.collectionItemId,
          storageLocationId: removal.storageLocationId,
        },
      }

      if (remaining === 0) await tx.collectionItemLocation.delete({ where })
      else await tx.collectionItemLocation.update({ where, data: { quantity: remaining } })
    }
  }

  // Depois a colecao anda, uma vez por carta e ja com o saldo dos dois lados
  // (item 5 da regra 4.7).
  for (const side of sides) {
    for (const change of side.deltas) {
      const cardVariantId = BigInt(change.variantId)
      const where = {
        collectionId_cardVariantId: { collectionId: side.collectionId, cardVariantId },
      }

      if (change.delta > 0) {
        await tx.collectionItem.upsert({
          where,
          create: { collectionId: side.collectionId, cardVariantId, quantity: change.delta },
          update: { quantity: { increment: change.delta } },
        })
        continue
      }

      const remaining = (side.owned.get(change.variantId) ?? 0) + change.delta

      // Quantidade zero e a ausencia da linha: e o que mantem "cartas unicas"
      // como uma contagem de linhas, e o CHECK do banco recusaria o zero.
      if (remaining <= 0) await tx.collectionItem.delete({ where })
      else await tx.collectionItem.update({ where, data: { quantity: remaining } })
    }
  }

  // Item 7: `completed_at` definido. E o que faz o valor historico da troca sair
  // do preco vigente naquele instante (regra 5.1).
  await tx.trade.update({
    where: { id: tradeId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  })
}

interface PlannedRemoval {
  collectionItemId: bigint
  storageLocationId: bigint
  /** O que o local guarda hoje, para decidir entre apagar a linha e reduzi-la. */
  held: number
  quantity: number
}

interface PlannedSide {
  collectionId: bigint
  /** Quantas cópias a pessoa possui hoje, por variante. */
  owned: Map<string, number>
  removals: PlannedRemoval[]
  deltas: CollectionDelta[]
}

/**
 * O que muda para um dos lados, conferido contra o estado de agora.
 *
 * Os itens 3 e 4 da regra 4.7 moram aqui: a variante pertence a quem a oferece,
 * e a quantidade oferecida está de fato disponível para troca. São verificadas
 * de novo, e não só na marcação — entre marcar e concluir pode ter passado uma
 * semana, e nesse meio a pessoa pode ter vendido a carta.
 */
async function planSide(
  tx: Prisma.TransactionClient,
  giver: ParticipantRow,
  receiver: ParticipantRow,
): Promise<PlannedSide> {
  const collection = await tx.collection.findUnique({
    where: { userId: giver.userId },
    select: { id: true },
  })
  if (!collection) throw new NotFoundError('Coleção não encontrada.')

  const variantIds = [
    ...new Set([
      ...giver.items.map((item) => item.cardVariantId),
      ...receiver.items.map((item) => item.cardVariantId),
    ]),
  ]

  const owned = new Map<string, number>()
  if (variantIds.length > 0) {
    /*
     * As linhas da colecao sao travadas em ordem de id. Nao e superstição: a
     * conclusao mexe em varias linhas, e duas transacoes que peguem as mesmas em
     * ordens diferentes travam uma na outra. Uma ordem so remove a possibilidade.
     */
    const rows = await tx.$queryRaw<{ card_variant_id: bigint; quantity: number }[]>`
      SELECT "card_variant_id", "quantity" FROM "collection_items"
      WHERE "collection_id" = ${collection.id}
        AND "card_variant_id" IN (${Prisma.join(variantIds)})
      ORDER BY "id"
      FOR UPDATE
    `
    for (const row of rows) owned.set(String(row.card_variant_id), row.quantity)
  }

  const stock = await tradeStock(
    tx,
    giver.userId,
    giver.items.map((item) => item.cardVariantId),
  )

  const removals: PlannedRemoval[] = []

  for (const item of giver.items) {
    const key = String(item.cardVariantId)

    // Item 3: toda variante oferecida pertence a quem a oferece.
    if ((owned.get(key) ?? 0) < item.quantity) {
      throw new ConflictError(
        'OFERTA_SEM_LASTRO',
        'Alguém não tem mais as cópias que ofereceu. A troca não foi concluída.',
      )
    }

    const held = stock.get(key)
    const plan = planOrigin(
      item.quantity,
      held?.allocations ?? [],
      item.origins.map((origin) => ({
        storageLocationId: String(origin.storageLocationId),
        quantity: origin.quantity,
      })),
    )

    // Item 4: a quantidade oferecida esta de fato disponivel para troca — agora,
    // e nao quando alguem marcou.
    if (!plan.ok || !held) {
      throw new ConflictError(
        originProblemCode(plan.ok ? 'INDISPONIVEL' : plan.reason),
        originProblemMessage(plan.ok ? 'INDISPONIVEL' : plan.reason),
      )
    }

    for (const removal of plan.removals) {
      const there = held.allocations.find(
        (allocation) => allocation.storageLocationId === removal.storageLocationId,
      )
      // `planOrigin` ja recusou local desconhecido; isto e estreitamento de tipo.
      if (!there) continue

      removals.push({
        collectionItemId: held.collectionItemId,
        storageLocationId: BigInt(removal.storageLocationId),
        held: there.quantity,
        quantity: removal.quantity,
      })
    }
  }

  return {
    collectionId: collection.id,
    owned,
    removals,
    deltas: collectionDeltas(toOffered(giver.items), toOffered(receiver.items)),
  }
}

interface ItemRow {
  id: bigint
  cardVariantId: bigint
  quantity: number
  origins: { storageLocationId: bigint; quantity: number }[]
}

interface ParticipantRow {
  id: bigint
  userId: bigint
  items: ItemRow[]
}

function toOffered(items: readonly ItemRow[]): OfferedCard[] {
  return items.map((item) => ({
    variantId: String(item.cardVariantId),
    quantity: item.quantity,
  }))
}

/**
 * Trava a troca antes de qualquer leitura que vire decisão.
 *
 * Duas marcações simultâneas leriam "o outro ainda não marcou", cada uma
 * gravaria só a própria, e a troca ficaria marcada pelos dois e nunca concluída
 * — que é o pior desfecho possível, porque parece que funcionou.
 */
async function lockTrade(
  tx: Prisma.TransactionClient,
  tradeId: bigint,
): Promise<{ status: TradeStatus; participants: ParticipantRow[] }> {
  const locked = await tx.$queryRaw<{ id: bigint }[]>`
    SELECT "id" FROM "trades" WHERE "id" = ${tradeId} FOR UPDATE
  `
  if (locked.length === 0) throw new NotFoundError('Troca não encontrada.')

  const trade = await tx.trade.findUniqueOrThrow({
    where: { id: tradeId },
    select: {
      status: true,
      participants: {
        select: {
          id: true,
          userId: true,
          items: {
            select: {
              id: true,
              cardVariantId: true,
              quantity: true,
              origins: { select: { storageLocationId: true, quantity: true } },
            },
          },
        },
      },
    },
  })

  return { status: trade.status as TradeStatus, participants: trade.participants }
}

interface VariantStock {
  collectionItemId: bigint
  allocations: Allocation[]
}

/**
 * O que uma pessoa tem em locais de troca, por variante.
 *
 * Só `purpose = 'TRADE'` (regra 4.1): cópias em armazenamento de coleção e em
 * decks continuam integralmente na coleção e não são o que se oferece.
 */
async function tradeStock(
  tx: Prisma.TransactionClient,
  userId: bigint,
  variantIds: readonly bigint[],
): Promise<Map<string, VariantStock>> {
  const byVariant = new Map<string, VariantStock>()
  if (variantIds.length === 0) return byVariant

  const rows = await tx.collectionItemLocation.findMany({
    where: {
      storageLocation: { userId, purpose: 'TRADE' },
      collectionItem: { collection: { userId }, cardVariantId: { in: [...variantIds] } },
    },
    select: {
      quantity: true,
      storageLocationId: true,
      collectionItem: { select: { id: true, cardVariantId: true } },
    },
    orderBy: { storageLocationId: 'asc' },
  })

  for (const row of rows) {
    const key = String(row.collectionItem.cardVariantId)
    const allocation: Allocation = {
      storageLocationId: String(row.storageLocationId),
      quantity: row.quantity,
    }

    const found = byVariant.get(key)
    if (found) found.allocations.push(allocation)
    else
      byVariant.set(key, {
        collectionItemId: row.collectionItem.id,
        allocations: [allocation],
      })
  }

  return byVariant
}

/** As cartas cuja origem precisa de escolha, já com o que a tela desenha. */
async function describeQuestions(
  tx: Prisma.TransactionClient,
  items: readonly ItemRow[],
  stock: Map<string, VariantStock>,
  variantIds: readonly bigint[],
): Promise<OriginQuestion[]> {
  const variants = await tx.cardVariant.findMany({
    where: { id: { in: [...variantIds] } },
    select: { id: true, imageUrl: true, card: { select: { code: true, name: true } } },
  })

  const locationIds = new Set<string>()
  for (const variantId of variantIds) {
    for (const allocation of stock.get(String(variantId))?.allocations ?? []) {
      locationIds.add(allocation.storageLocationId)
    }
  }

  const names = await tx.storageLocation.findMany({
    where: { id: { in: [...locationIds].map((id) => BigInt(id)) } },
    select: { id: true, name: true },
  })
  const nameById = new Map(names.map((row) => [String(row.id), row.name]))

  return variants.map((variant) => {
    const key = String(variant.id)
    const item = items.find((candidate) => String(candidate.cardVariantId) === key)

    return {
      variantId: key,
      cardCode: variant.card.code,
      cardName: variant.card.name,
      imageUrl: variant.imageUrl,
      offered: item?.quantity ?? 0,
      locations: (stock.get(key)?.allocations ?? []).map((allocation) => ({
        storageLocationId: allocation.storageLocationId,
        storageName: nameById.get(allocation.storageLocationId) ?? 'Local de troca',
        quantity: allocation.quantity,
      })),
    }
  })
}

function originProblemCode(reason: OriginProblem): string {
  return reason === 'INDISPONIVEL' ? 'OFERTA_SEM_LASTRO' : 'ORIGEM_INVALIDA'
}

function originProblemMessage(reason: OriginProblem): string {
  switch (reason) {
    case 'INDISPONIVEL':
      return 'Alguém não tem mais essas cópias disponíveis para troca. A troca não foi concluída.'
    case 'SOMA_DIFERENTE':
      return 'A escolha precisa somar exatamente as cópias que estão sendo trocadas.'
    case 'ALEM_DO_ALOCADO':
      return 'Um dos locais não tem tantas cópias assim. Recarregue e tente de novo.'
    case 'LOCAL_DESCONHECIDO':
      return 'Um dos locais não guarda mais esta carta. Recarregue e tente de novo.'
    default:
      return 'Escolha de onde saem as cópias de cada carta.'
  }
}
