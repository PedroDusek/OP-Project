import type { PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { displaySetCode, displaySetName } from '@/server/domain/catalog/sets'
import { NotFoundError, ValidationError } from '@/server/domain/errors'
import { STARTER_DECK_CARDS } from '@/server/domain/catalog/starter-decks'
import {
  loadStarterDecks,
  STARTER_DECKS_PATH,
} from '@/server/infrastructure/catalog/starter-decks-file'
import { bulkAddToLocation, type BulkEntry } from './bulk'

/**
 * Pôr num local o deck que vem na caixa de um starter deck (decisão 117).
 *
 * Camada: application.
 *
 * Quem comprou um ST não quer registrar 51 cartas uma a uma. A composição já
 * está conferida (decisão 116) em `data/starter-decks.json`, e aqui ela vira
 * uma leva — a mesma máquina de "Adicionar cartas", que soma na coleção e aloca
 * no local numa transação só.
 *
 * ## O que entra
 *
 * **O líder e as 50**, escolha do dono do produto. Uma cópia de cada líder
 * impresso no set, o que dá 1 nos decks normais e **3** no ST-10 e no ST-13 —
 * que é o que a caixa traz ("Constructed Deck x1 (51 cards), Alternative Leader
 * Card x2").
 *
 * **Os DON!! ficam de fora.** A caixa traz dez, mas nenhum DON!! está vinculado
 * a nenhum ST no catálogo, e inventar esse vínculo seria adivinhar.
 *
 * ## Qual arte
 *
 * A **impressa neste set**, preferindo a Normal. Uma carta pode ter duas artes
 * no mesmo produto, e a do deck é a base — a paralela, quando existe, é a de
 * tratamento. Sem este cuidado, uma carta reimpressa cairia na arte de outra
 * coleção, e a pessoa ganharia na coleção uma carta que não está na caixa dela.
 */

/** Quantas vezes dá para pôr o mesmo deck de uma vez. */
export const MAX_STARTER_DECK_COPIES = 12

export interface StarterDeckOption {
  code: string
  displayCode: string
  displayName: string
  /** Cartas distintas, sem os líderes. */
  cards: number
  leaders: number
  /** A arte de um líder, para a lista ter rosto. */
  coverUrl: string | null
}

export interface AddStarterDeckResult {
  /** Variantes distintas tocadas. */
  cards: number
  /** Cópias acrescentadas, somadas. */
  copies: number
  times: number
}

/**
 * Os decks que dá para adicionar: os que **já foram conferidos**.
 *
 * Um ST sem composição na tabela não aparece. Mostrá-lo e falhar no clique
 * seria pior que não mostrar — e oferecer "adicionar" sem saber o que adicionar
 * é exatamente o que a decisão 116 existe para impedir.
 */
export async function listStarterDeckOptions(
  prisma: PrismaClient,
  path: string = STARTER_DECKS_PATH,
): Promise<StarterDeckOption[]> {
  const tabela = loadStarterDecks(path)
  if (tabela.length === 0) return []

  const sets = await prisma.set.findMany({
    where: { code: { in: tabela.map((entry) => entry.deck) } },
    select: {
      id: true,
      code: true,
      name: true,
      printings: {
        where: { cardVariant: { card: { type: 'Leader' } } },
        select: {
          cardVariant: {
            select: {
              variantType: true,
              imageUrl: true,
              card: { select: { code: true } },
            },
          },
        },
      },
    },
  })

  const porCodigo = new Map(sets.map((set) => [set.code, set]))

  return tabela
    .flatMap((entry) => {
      const set = porCodigo.get(entry.deck)
      // Deck na tabela e ausente do catalogo: a tabela esta adiante do banco.
      if (!set) return []

      /*
       * Lideres **distintos**, e nao impressoes.
       *
       * Um lider pode ter arte paralela impressa no mesmo set, e contar as
       * impressoes dizia "2 lideres" no ST-21, ST-22, ST-29 e ST-30 — que tem
       * um so. A caixa traz uma carta; a segunda arte e tratamento.
       */
      const artes = set.printings.map((printing) => printing.cardVariant)
      const lideres = [...new Set(artes.map((arte) => arte.card.code))]
      const capa =
        artes.find((a) => a.variantType === 'Normal' && a.imageUrl !== null) ??
        artes.find((a) => a.imageUrl !== null)

      return [
        {
          code: set.code,
          displayCode: displaySetCode(set.code),
          displayName: displaySetName(set.name),
          cards: entry.cartas.length,
          leaders: lideres.length,
          coverUrl: capa?.imageUrl ?? null,
        },
      ]
    })
    .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }))
}

/**
 * As cartas de um deck, resolvidas para artes deste catálogo.
 *
 * Separado do que grava para a tela poder mostrar **o que vai entrar** antes de
 * a pessoa confirmar: adicionar 51 cartas é fácil de fazer e chato de desfazer.
 */
export interface StarterDeckContents {
  code: string
  displayCode: string
  displayName: string
  leaders: StarterDeckLine[]
  cards: StarterDeckLine[]
  /** Cópias do deck inteiro, com o líder. */
  totalCopies: number
}

export interface StarterDeckLine {
  cardVariantId: string
  cardCode: string
  cardName: string
  rarity: string | null
  imageUrl: string | null
  copies: number
}

async function lerDeck(
  prisma: PrismaClient,
  deckCode: string,
  path: string,
): Promise<{ leaders: StarterDeckLine[]; cards: StarterDeckLine[]; set: { code: string; name: string } }> {
  const entrada = loadStarterDecks(path).find((item) => item.deck === deckCode)
  if (!entrada) {
    throw new NotFoundError(`A composição do ${deckCode} ainda não foi conferida.`)
  }

  const set = await prisma.set.findFirst({
    where: { code: deckCode },
    select: { id: true, code: true, name: true },
  })
  if (!set) throw new NotFoundError(`${deckCode} não existe no catálogo.`)

  const printings = await prisma.variantPrinting.findMany({
    where: { setId: set.id },
    select: {
      cardVariant: {
        select: {
          id: true,
          variantType: true,
          rarity: true,
          imageUrl: true,
          card: { select: { code: true, name: true, type: true } },
        },
      },
    },
  })

  /*
   * Uma arte por carta, preferindo a Normal.
   *
   * O produto traz a arte base; a paralela, quando sai no mesmo set, e a de
   * tratamento. Sem a preferencia, qual das duas entraria dependeria da ordem
   * em que o banco devolve as linhas.
   */
  const porCarta = new Map<string, (typeof printings)[number]['cardVariant']>()
  for (const printing of printings) {
    const arte = printing.cardVariant
    const anterior = porCarta.get(arte.card.code)
    if (!anterior || (anterior.variantType !== 'Normal' && arte.variantType === 'Normal')) {
      porCarta.set(arte.card.code, arte)
    }
  }

  const linha = (code: string, copies: number): StarterDeckLine => {
    const arte = porCarta.get(code)
    if (!arte) {
      throw new NotFoundError(`A carta ${code} não está mais impressa em ${deckCode}.`)
    }
    return {
      cardVariantId: String(arte.id),
      cardCode: arte.card.code,
      cardName: arte.card.name,
      rarity: arte.rarity,
      imageUrl: arte.imageUrl,
      copies,
    }
  }

  const leaders = [...porCarta.values()]
    .filter((arte) => arte.card.type === 'Leader')
    .map((arte) => linha(arte.card.code, 1))
    .sort((a, b) => a.cardCode.localeCompare(b.cardCode, 'en'))

  const cards = entrada.cartas.map((item) => linha(item.carta, item.copias))

  return { leaders, cards, set }
}

export async function readStarterDeckContents(
  prisma: PrismaClient,
  deckCode: string,
  path: string = STARTER_DECKS_PATH,
): Promise<StarterDeckContents> {
  const { leaders, cards, set } = await lerDeck(prisma, deckCode, path)

  return {
    code: set.code,
    displayCode: displaySetCode(set.code),
    displayName: displaySetName(set.name),
    leaders,
    cards,
    totalCopies:
      leaders.length + cards.reduce((soma, linha) => soma + linha.copies, 0),
  }
}

/**
 * Põe o deck no local, uma ou mais vezes.
 *
 * Não há desfazer: é a mesma leva de "Adicionar cartas", e desfazê-la exigiria
 * decidir o que fazer com cópias que a pessoa já moveu de lugar. Por isso a
 * tela mostra o que vai entrar antes.
 */
export async function addStarterDeckToLocation(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  storageLocationId: bigint,
  deckCode: string,
  times = 1,
  path: string = STARTER_DECKS_PATH,
): Promise<AddStarterDeckResult> {
  if (!Number.isInteger(times) || times < 1 || times > MAX_STARTER_DECK_COPIES) {
    throw new ValidationError(
      `Dá para adicionar de 1 a ${MAX_STARTER_DECK_COPIES} vezes de uma vez.`,
    )
  }

  const { leaders, cards } = await lerDeck(prisma, deckCode, path)

  /*
   * O lider entra com uma copia por vez que o deck entra, como as 50: quem
   * comprou duas caixas tem dois lideres.
   */
  const entries: BulkEntry[] = [...leaders, ...cards].map((linha) => ({
    cardVariantId: BigInt(linha.cardVariantId),
    copies: linha.copies * times,
  }))

  const resultado = await bulkAddToLocation(prisma, user, storageLocationId, entries)

  return { ...resultado, times }
}

export { STARTER_DECK_CARDS }
