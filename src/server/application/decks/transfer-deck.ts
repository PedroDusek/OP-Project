import type { PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { assertPremium } from '@/server/application/authorization'
import { ConflictError, NotFoundError, ValidationError } from '@/server/domain/errors'

/**
 * Transferir as cartas de uma decklist para uma deckbox (decisão 109).
 *
 * Camada: application.
 *
 * Pedido do dono do produto em 22/09: montado o deck de papel, dizer ao ColeXa
 * que aquelas cartas agora moram na caixa do deck — em vez de corrigir o local
 * de cinquenta e uma cartas a mão.
 *
 * ## A regra 3.3 é o que dá forma a tudo aqui
 *
 * *"Nenhuma ordem de remoção é presumida... ninguém decide por quem tem a carta
 * de qual local as cópias saem."* Transferir um deck inteiro esbarraria nisso, e
 * o dono do produto resolveu assim:
 *
 * - dá para tirar tudo de **uma única alocação fora de troca**? o sistema tira;
 * - há **mais de uma possibilidade**? ele **pergunta**;
 * - **local de troca não entra por padrão**: o sistema tenta completar sem ele, e
 *   só usa o que está em troca se a pessoa confirmar.
 *
 * ## Por que "alocação" e não "local"
 *
 * No banco a unidade é **arte × local** (`collection_item_locations`). Uma carta
 * pode estar em dois lugares *e* em duas artes, e as duas escolhas são a mesma
 * pergunta: de qual pilha sai esta cópia. Tratá-las juntas é o que mantém a
 * transferência coerente com a barra de progresso, que já conta qualquer arte.
 *
 * ## O que este caso de uso nunca faz
 *
 * Ele **não desfaz**. Trocar o local de uma carta apaga de onde ela estava, e
 * essa informação não existe em nenhum outro lugar — por isso a tela exige
 * confirmação dizendo que a pessoa só confirme depois de ter movido as cartas de
 * verdade.
 */

export interface TransferOption {
  variantId: string
  variantType: string
  locationId: string
  locationName: string
  /** Quantas cópias estão nesta alocação. */
  available: number
  /** `true` para local com finalidade de troca (regra 4.2). */
  trade: boolean
  /**
   * Estas cópias são de **outra arte** da mesma carta.
   *
   * Mesmo aviso que a conferência já dá (`DeckPlace.otherArt`, decisão 095):
   * quem montou pediu uma arte e vai guardar outra na deckbox. O sistema não
   * impede — para jogar a arte não importa —, mas dizer é obrigação, senão a
   * pessoa descobre ao abrir a caixa.
   */
  otherArt: boolean
}

export interface TransferTake {
  variantId: string
  locationId: string
  copies: number
}

export type TransferLineStatus =
  /** O sistema resolveu sozinho: uma alocação fora de troca cobre tudo. */
  | 'auto'
  /** Mais de uma possibilidade: quem decide é a pessoa (regra 3.3). */
  | 'ambiguous'
  /** Só dá para completar usando cópias que estão em local de troca. */
  | 'trade-needed'
  /** A pessoa não tem essas cópias em lugar nenhum com local registrado. */
  | 'missing'
  /** Já está toda na deckbox de destino. */
  | 'done'

export interface TransferLine {
  cardCode: string
  cardName: string
  /** Quantas cópias a lista pede. O líder conta 1. */
  needed: number
  status: TransferLineStatus
  /** Preenchido em `auto`: de onde as cópias sairão. */
  take: TransferTake[]
  /** Em `auto`: as cópias resolvidas são de outra arte da mesma carta. */
  takeOtherArt: boolean
  /** Preenchido em `ambiguous` e `trade-needed`: as pilhas possíveis. */
  options: TransferOption[]
}

export interface TransferPlan {
  deckId: string
  deckName: string
  destination: { id: string; name: string }
  lines: TransferLine[]
  /** Quantas cópias sairiam de um local de troca, se a pessoa confirmar. */
  fromTradeCopies: number
}

/**
 * O que aconteceria, sem mexer em nada.
 *
 * Existe separado da execução porque a tela precisa mostrar as escolhas **antes**
 * de a pessoa confirmar — e porque a confirmação dela é o aviso de que as cartas
 * já foram movidas de verdade.
 */
export async function planDeckTransfer(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  deckId: string,
  destinationId: string,
): Promise<TransferPlan> {
  assertPremium(user, 'As decklists são um recurso Premium.')

  const destino = await deckBoxDe(prisma, user, destinationId)
  const deck = await deckDe(prisma, user, deckId)

  const pedidas = pedidasPorCodigo(deck)
  const alocacoes = await alocacoesDe(prisma, user, [...pedidas.keys()])

  const lines: TransferLine[] = []
  let fromTradeCopies = 0

  for (const [cardCode, { cardName, needed, arts }] of pedidas) {
    const pilhas = (alocacoes.get(cardCode) ?? [])
      .filter((p) => p.locationId !== String(destino.id))
      .map((p) => ({ ...p, otherArt: !arts.has(p.variantId) }))
    const jaNoDestino = (alocacoes.get(cardCode) ?? [])
      .filter((p) => p.locationId === String(destino.id))
      .reduce((soma, p) => soma + p.available, 0)

    const falta = needed - jaNoDestino
    if (falta <= 0) {
      lines.push({ cardCode, cardName, needed, status: 'done', take: [], takeOtherArt: false, options: [] })
      continue
    }

    const foraDeTroca = pilhas.filter((p) => !p.trade)

    /*
     * O caso feliz da regra do dono do produto: **uma** pilha fora de troca que
     * sozinha cobre o que falta. Sem escolha a fazer, sem perguntar.
     *
     * Duas pilhas que cobrem juntas **não** contam: aí há mais de uma origem
     * possível, e decidir seria presumir a ordem que a regra 3.3 protege.
     */
    const sozinhas = foraDeTroca.filter((p) => p.available >= falta)
    if (sozinhas.length === 1 && foraDeTroca.length === 1) {
      lines.push({
        cardCode,
        cardName,
        needed,
        status: 'auto',
        take: [{ variantId: sozinhas[0].variantId, locationId: sozinhas[0].locationId, copies: falta }],
        // Resolver sozinho não dispensa avisar: a pessoa pediu uma arte e vai
        // guardar outra na caixa (decisão 095, o mesmo aviso da conferência).
        takeOtherArt: sozinhas[0].otherArt,
        options: [],
      })
      continue
    }

    if (foraDeTroca.length > 0) {
      lines.push({ cardCode, cardName, needed, status: 'ambiguous', take: [], takeOtherArt: false, options: foraDeTroca })
      continue
    }

    const emTroca = pilhas.filter((p) => p.trade)
    if (emTroca.length > 0) {
      fromTradeCopies += Math.min(falta, emTroca.reduce((soma, p) => soma + p.available, 0))
      lines.push({ cardCode, cardName, needed, status: 'trade-needed', take: [], takeOtherArt: false, options: emTroca })
      continue
    }

    lines.push({ cardCode, cardName, needed, status: 'missing', take: [], takeOtherArt: false, options: [] })
  }

  return {
    deckId: String(deck.id),
    deckName: deck.name,
    destination: { id: String(destino.id), name: destino.name },
    lines,
    fromTradeCopies,
  }
}

export interface TransferResult {
  /** Cópias que mudaram de lugar. */
  moved: number
  /** Cartas que a pessoa não tinha, ou não escolheu de onde tirar. */
  skipped: number
}

/**
 * Executa a transferência.
 *
 * As escolhas vêm da tela, e **são conferidas de novo aqui**: a tela é
 * conveniência, e um envio à mão poderia pedir cópias que não existem naquela
 * pilha, ou de um local de outra pessoa.
 *
 * Tudo numa transação: um deck meio transferido seria pior que nenhum, porque
 * ninguém saberia quais cartas já tinham mudado de lugar.
 */
export async function executeDeckTransfer(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  deckId: string,
  destinationId: string,
  takes: readonly TransferTake[],
): Promise<TransferResult> {
  assertPremium(user, 'As decklists são um recurso Premium.')
  if (takes.length === 0) throw new ValidationError('Nada para transferir.')

  const destino = await deckBoxDe(prisma, user, destinationId)
  const deck = await deckDe(prisma, user, deckId)
  const pedidas = pedidasPorCodigo(deck)

  return prisma.$transaction(async (tx) => {
    let moved = 0

    for (const take of takes) {
      if (!Number.isInteger(take.copies) || take.copies <= 0) {
        throw new ValidationError('Quantidade inválida na transferência.')
      }
      if (take.locationId === String(destino.id)) {
        throw new ConflictError('MESMO_LOCAL', 'A carta já está na deckbox escolhida.')
      }

      const item = await tx.collectionItem.findFirst({
        where: { cardVariantId: BigInt(take.variantId), collection: { userId: user.id } },
        select: { id: true, cardVariant: { select: { card: { select: { code: true } } } } },
      })
      if (!item) throw new NotFoundError('Você não tem esta carta na coleção.')

      // A carta precisa ser da lista: transferir "o deck" não pode virar uma
      // forma de mover qualquer carta da coleção.
      if (!pedidas.has(item.cardVariant.card.code)) {
        throw new ValidationError('Esta carta não está na decklist.')
      }

      // O mesmo lock de toda escrita de alocação (`storage/move.ts`): sem ele,
      // mover enquanto a quantidade possuída cai deixaria o destino acima do
      // que se tem.
      await tx.$queryRaw`SELECT quantity FROM collection_items WHERE id = ${item.id} FOR UPDATE`

      const origem = await tx.collectionItemLocation.findUnique({
        where: {
          collectionItemId_storageLocationId: {
            collectionItemId: item.id,
            storageLocationId: BigInt(take.locationId),
          },
        },
        select: { quantity: true, storageLocation: { select: { userId: true } } },
      })
      if (!origem || origem.storageLocation.userId !== user.id) {
        throw new NotFoundError('Esta carta não está mais neste local.')
      }
      if (take.copies > origem.quantity) {
        throw new ConflictError(
          'COPIAS_INSUFICIENTES_NO_LOCAL',
          `Só há ${origem.quantity} ${origem.quantity === 1 ? 'cópia' : 'cópias'} neste local.`,
        )
      }

      // Tira primeiro, põe depois: o trigger que confere a soma roda por linha,
      // e acrescentar antes faria a soma passar do possuído por um instante.
      const restante = origem.quantity - take.copies
      const chave = (storageLocationId: bigint) => ({
        collectionItemId_storageLocationId: { collectionItemId: item.id, storageLocationId },
      })

      if (restante === 0) {
        await tx.collectionItemLocation.delete({ where: chave(BigInt(take.locationId)) })
      } else {
        await tx.collectionItemLocation.update({
          where: chave(BigInt(take.locationId)),
          data: { quantity: restante },
        })
      }

      await tx.collectionItemLocation.upsert({
        where: chave(destino.id),
        create: { collectionItemId: item.id, storageLocationId: destino.id, quantity: take.copies },
        update: { quantity: { increment: take.copies } },
      })

      moved += take.copies
    }

    const pedidoTotal = [...pedidas.values()].reduce((soma, p) => soma + p.needed, 0)
    return { moved, skipped: Math.max(0, pedidoTotal - moved) }
  })
}

// ------------------------------------------------------------------ leitura

/** A deckbox de destino. Só tipo `DECK`, por escolha do dono do produto. */
async function deckBoxDe(prisma: PrismaClient, user: AuthenticatedUser, id: string) {
  if (!/^\d+$/.test(id)) throw new NotFoundError('Deckbox não encontrada.')

  const local = await prisma.storageLocation.findFirst({
    where: { id: BigInt(id), userId: user.id },
    select: { id: true, name: true, type: true },
  })
  if (!local) throw new NotFoundError('Deckbox não encontrada.')
  if (local.type !== 'DECK') {
    throw new ValidationError('O destino precisa ser um deck. Escolha uma deckbox.')
  }
  return local
}

async function deckDe(prisma: PrismaClient, user: AuthenticatedUser, id: string) {
  if (!/^\d+$/.test(id)) throw new NotFoundError('Lista não encontrada.')

  const deck = await prisma.deck.findFirst({
    where: { id: BigInt(id), userId: user.id },
    select: {
      id: true,
      name: true,
      leaderVariant: { select: { id: true, card: { select: { code: true, name: true } } } },
      items: {
        select: {
          copies: true,
          cardVariant: { select: { id: true, card: { select: { code: true, name: true } } } },
        },
      },
    },
  })
  if (!deck) throw new NotFoundError('Lista não encontrada.')
  return deck
}

type Deck = Awaited<ReturnType<typeof deckDe>>

interface Pedida {
  cardName: string
  needed: number
  /** As artes que a lista escolheu para este código. */
  arts: Set<string>
}

/** O que a lista pede, por código — o líder conta 1 (regra 7). */
function pedidasPorCodigo(deck: Deck): Map<string, Pedida> {
  const pedidas = new Map<string, Pedida>()
  const soma = (code: string, cardName: string, variantId: string, copies: number) => {
    const atual = pedidas.get(code)
    const arts = atual?.arts ?? new Set<string>()
    arts.add(variantId)
    pedidas.set(code, { cardName, needed: (atual?.needed ?? 0) + copies, arts })
  }

  soma(
    deck.leaderVariant.card.code,
    deck.leaderVariant.card.name,
    String(deck.leaderVariant.id),
    1,
  )
  for (const item of deck.items) {
    soma(
      item.cardVariant.card.code,
      item.cardVariant.card.name,
      String(item.cardVariant.id),
      item.copies,
    )
  }
  return pedidas
}

/**
 * Onde estão as cópias de cada código, arte por arte e local por local.
 *
 * Numa consulta só: uma por carta seriam cinquenta e uma idas ao banco para
 * desenhar uma tela.
 */
async function alocacoesDe(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  codes: readonly string[],
): Promise<Map<string, TransferOption[]>> {
  if (codes.length === 0) return new Map()

  const linhas = await prisma.collectionItemLocation.findMany({
    where: {
      collectionItem: {
        collection: { userId: user.id },
        cardVariant: { card: { code: { in: [...codes] } } },
      },
    },
    select: {
      quantity: true,
      storageLocation: { select: { id: true, name: true, purpose: true } },
      collectionItem: {
        select: {
          cardVariant: { select: { id: true, variantType: true, card: { select: { code: true } } } },
        },
      },
    },
  })

  const porCodigo = new Map<string, TransferOption[]>()
  for (const linha of linhas) {
    const variante = linha.collectionItem.cardVariant
    const code = variante.card.code
    const lista = porCodigo.get(code) ?? []
    lista.push({
      variantId: String(variante.id),
      variantType: variante.variantType,
      locationId: String(linha.storageLocation.id),
      locationName: linha.storageLocation.name,
      available: linha.quantity,
      trade: linha.storageLocation.purpose === 'TRADE',
      // Preenchido por quem conhece a lista: aqui só se sabe o que existe na
      // coleção, e não qual arte o deck escolheu.
      otherArt: false,
    })
    porCodigo.set(code, lista)
  }
  return porCodigo
}
