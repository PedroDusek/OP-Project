import type { PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { assertPremium } from '@/server/application/authorization'
import { DECK_SIZE } from '@/server/domain/decks/deck'
import { NotFoundError, ValidationError } from '@/server/domain/errors'
import { conferirLista } from './analyze-deck'
import type { DeckInput } from './analyze-deck'

/**
 * As decklists salvas (decisão 108, que muda a 095).
 *
 * Camada: application.
 *
 * A 095 dizia que o ColeXa não guardava decks — "guardá-los é outro produto".
 * Usuários pediram o contrário: montar aos poucos, dar nome e acompanhar quanto
 * falta. O dono do produto inverteu a escolha em 22/09.
 *
 * ## O que **não** vira coluna
 *
 * A **capa** é a arte do líder, e "**incompleto**" é a soma das cópias abaixo de
 * cinquenta. Guardar qualquer um dos dois criaria uma segunda verdade que
 * envelhece: bastaria a carta trocar de arte no catálogo, ou alguém editar a
 * lista, para o banco passar a contar uma história diferente da tela.
 *
 * ## Premium
 *
 * O Deck Builder é Premium (decisão 093), e as listas seguem. Quem perde o
 * Premium **não perde as listas**: elas continuam guardadas e param de abrir
 * (escolha do dono do produto em 22/09). Por isso `listDecks` **não** exige
 * Premium — é ela que diz "você tem 3 listas, e precisa de Premium para abrir".
 */

/** Nome só para a pessoa se guiar. O tamanho é o da coluna. */
const MAX_NOME = 100

export interface SavedDeckInput extends DeckInput {
  /** Nulo cria; preenchido regrava a lista que já existe. */
  id?: string | null
  name: string
}

export interface SavedDeckSummary {
  id: string
  name: string
  /** A capa: a arte do líder. */
  leader: { variantId: string; cardCode: string; cardName: string; imageUrl: string | null }
  /** Quantas cartas a lista tem, sem o líder. */
  cards: number
  /** `true` enquanto a lista não fecha as cinquenta. */
  incomplete: boolean
  /** Quantas das 51 a pessoa já tem, contando qualquer arte da mesma carta. */
  owned: number
  updatedAt: Date
}

/** As 51: o líder entra na conta (regra 7). */
export const DECK_TOTAL_COM_LIDER = DECK_SIZE + 1

/**
 * Grava a lista, criando ou regravando.
 *
 * As regras do deck são conferidas pelo **mesmo** código da conferência
 * (`conferirLista`): salvar não pode aceitar o que a tela recusa.
 *
 * A gravação é uma transação com `deleteMany` seguido de `createMany` nos itens.
 * Regravar item a item exigiria descobrir o que saiu, o que entrou e o que mudou
 * de contagem — três consultas e um estado intermediário inválido no meio.
 */
export async function saveDeck(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  input: SavedDeckInput,
): Promise<{ id: string }> {
  assertPremium(user, 'As decklists são um recurso Premium.')

  const name = input.name.trim()
  if (!name) throw new ValidationError('Dê um nome à lista.')
  if (name.length > MAX_NOME) throw new ValidationError(`O nome tem no máximo ${MAX_NOME} caracteres.`)

  // O líder é obrigatório e as cartas podem faltar: a lista incompleta é o caso
  // normal de quem monta aos poucos, e é ela que ganha a marca "incompleta".
  const { lines } = await conferirLista(prisma, input)

  return prisma.$transaction(async (tx) => {
    const deckId = input.id ? BigInt(input.id) : null

    if (deckId) {
      // `updateMany` com o dono no `where`: uma lista de outra pessoa não é
      // encontrada, em vez de ser encontrada e recusada depois.
      const { count } = await tx.deck.updateMany({
        where: { id: deckId, userId: user.id },
        data: { name, leaderVariantId: BigInt(input.leaderVariantId) },
      })
      if (count === 0) throw new NotFoundError('Lista não encontrada.')
      await tx.deckItem.deleteMany({ where: { deckId } })
      await tx.deckItem.createMany({ data: itensDe(deckId, lines) })
      return { id: String(deckId) }
    }

    const criado = await tx.deck.create({
      data: {
        userId: user.id,
        name,
        leaderVariantId: BigInt(input.leaderVariantId),
        items: { createMany: { data: lines.map((line) => ({ cardVariantId: BigInt(line.variantId), copies: line.copies })) } },
      },
      select: { id: true },
    })
    return { id: String(criado.id) }
  })
}

function itensDe(deckId: bigint, lines: readonly { variantId: string; copies: number }[]) {
  return lines.map((line) => ({ deckId, cardVariantId: BigInt(line.variantId), copies: line.copies }))
}

/**
 * As listas da pessoa, com o progresso.
 *
 * **Não exige Premium**: quem perdeu o acesso continua vendo que tem listas, e
 * que precisa de Premium para abrir. Esconder aqui apagaria da vista o que a
 * pessoa construiu, e é o oposto de "ficam guardadas".
 *
 * O progresso conta **qualquer arte da mesma carta** — a escolha do dono do
 * produto, equivalente ao auto completar ligado. A pergunta que ele responde é
 * "consigo jogar este deck?", e para jogar a arte não importa.
 *
 * Tudo numa consulta só: uma por lista seria uma ida ao banco por cartão na
 * tela.
 */
export async function listDecks(
  prisma: PrismaClient,
  user: AuthenticatedUser,
): Promise<SavedDeckSummary[]> {
  const decks = await prisma.deck.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      leaderVariant: {
        select: { id: true, imageUrl: true, card: { select: { code: true, name: true } } },
      },
      items: { select: { copies: true, cardVariant: { select: { card: { select: { code: true } } } } } },
    },
  })
  if (decks.length === 0) return []

  const posse = await possePorCodigo(prisma, user)

  return decks.map((deck) => {
    const cards = deck.items.reduce((soma, item) => soma + item.copies, 0)

    /*
     * O quanto a pessoa tem, código a código, limitado ao que a lista pede: ter
     * oito cópias de uma carta não adianta para um deck que pede quatro.
     */
    const precisa = new Map<string, number>()
    precisa.set(deck.leaderVariant.card.code, 1)
    for (const item of deck.items) {
      const code = item.cardVariant.card.code
      precisa.set(code, (precisa.get(code) ?? 0) + item.copies)
    }

    let owned = 0
    for (const [code, quantas] of precisa) {
      owned += Math.min(quantas, posse.get(code) ?? 0)
    }

    return {
      id: String(deck.id),
      name: deck.name,
      leader: {
        variantId: String(deck.leaderVariant.id),
        cardCode: deck.leaderVariant.card.code,
        cardName: deck.leaderVariant.card.name,
        imageUrl: deck.leaderVariant.imageUrl,
      },
      cards,
      incomplete: cards < DECK_SIZE,
      owned,
      updatedAt: deck.updatedAt,
    }
  })
}

/**
 * Quantas cópias a pessoa tem de cada código, somando as artes.
 *
 * A coleção inteira numa consulta. Pedir só os códigos das listas exigiria
 * montar um `IN` que cresce com o número de listas, e a coleção de quem monta
 * deck não é grande o bastante para isso valer.
 */
async function possePorCodigo(
  prisma: PrismaClient,
  user: AuthenticatedUser,
): Promise<Map<string, number>> {
  const itens = await prisma.collectionItem.findMany({
    where: { collection: { userId: user.id } },
    select: { quantity: true, cardVariant: { select: { card: { select: { code: true } } } } },
  })

  const total = new Map<string, number>()
  for (const item of itens) {
    const code = item.cardVariant.card.code
    total.set(code, (total.get(code) ?? 0) + item.quantity)
  }
  return total
}

interface CartaSalva {
  variantId: string
  cardCode: string
  cardName: string
  variantType: string
  imageUrl: string | null
}

export interface SavedDeck {
  id: string
  name: string
  /** O líder já com as cores: é delas que sai o filtro do resto da lista. */
  leader: CartaSalva & { colors: string[] }
  lines: (CartaSalva & { copies: number })[]
}

/**
 * A lista, pronta para reabrir no builder.
 *
 * Devolve os dados de exibição, e não só os identificadores: o builder desenha
 * código, nome e arte de cada linha, e as **cores do líder** são o que filtra a
 * busca do resto. Devolver só os ids obrigaria a tela a buscar tudo de novo,
 * uma carta por vez, no primeiro desenho.
 */
export async function readDeck(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  id: string,
): Promise<SavedDeck> {
  assertPremium(user, 'As decklists são um recurso Premium.')
  if (!/^\d+$/.test(id)) throw new NotFoundError('Lista não encontrada.')

  const carta = {
    id: true,
    variantType: true,
    imageUrl: true,
    card: { select: { code: true, name: true } },
  } as const

  const deck = await prisma.deck.findFirst({
    where: { id: BigInt(id), userId: user.id },
    select: {
      id: true,
      name: true,
      leaderVariant: {
        select: { ...carta, card: { select: { code: true, name: true, colors: { select: { color: { select: { name: true } } } } } } },
      },
      items: { select: { copies: true, cardVariant: { select: carta } } },
    },
  })
  if (!deck) throw new NotFoundError('Lista não encontrada.')

  return {
    id: String(deck.id),
    name: deck.name,
    leader: {
      variantId: String(deck.leaderVariant.id),
      cardCode: deck.leaderVariant.card.code,
      cardName: deck.leaderVariant.card.name,
      variantType: deck.leaderVariant.variantType,
      imageUrl: deck.leaderVariant.imageUrl,
      colors: deck.leaderVariant.card.colors.map((c) => c.color.name),
    },
    lines: deck.items.map((item) => ({
      variantId: String(item.cardVariant.id),
      cardCode: item.cardVariant.card.code,
      cardName: item.cardVariant.card.name,
      variantType: item.cardVariant.variantType,
      imageUrl: item.cardVariant.imageUrl,
      copies: item.copies,
    })),
  }
}

/**
 * Apaga a lista.
 *
 * Sem Premium também: quem deixou de assinar continua dono do que criou, e
 * impedir a faxina prenderia a pessoa a uma tela que ela não pode mais usar.
 */
export async function deleteDeck(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  id: string,
): Promise<void> {
  if (!/^\d+$/.test(id)) throw new NotFoundError('Lista não encontrada.')

  const { count } = await prisma.deck.deleteMany({ where: { id: BigInt(id), userId: user.id } })
  if (count === 0) throw new NotFoundError('Lista não encontrada.')
}
