import type { PrismaClient } from '@prisma/client'
import { displaySetCode, displaySetName } from '@/server/domain/catalog/sets'
import {
  missingForDeck,
  STARTER_DECK_CARDS,
  validateStarterDecks,
  type StarterDeckCopies,
  type StarterDeckEntry,
} from '@/server/domain/catalog/starter-decks'
import { NotFoundError, ValidationError } from '@/server/domain/errors'
import {
  loadStarterDecks,
  saveStarterDecks,
  STARTER_DECKS_PATH,
} from '@/server/infrastructure/catalog/starter-decks-file'

/**
 * A conferência de quantas cópias cada starter deck traz (decisão 116).
 *
 * Camada: application.
 *
 * O catálogo sabe **quais** cartas saem em cada ST; nenhuma fonte legível
 * publica **quantas de cada**. Então quem diz é gente, um deck por vez — mesmo
 * gesto da tabela dos DON!! e da conferência da Liga.
 *
 * ## Só fora de produção
 *
 * Grava `data/starter-decks.json`, um arquivo do repositório. A recusa está
 * aqui, e não só na tela, porque a ação pode ser chamada sem ela — é a mesma
 * guarda da conferência da Liga e da tabela dos DON!!.
 */

export function starterDecksAvailable(): boolean {
  return process.env.NODE_ENV !== 'production'
}

function exigirDesenvolvimento(): void {
  if (!starterDecksAvailable()) {
    throw new ValidationError('A conferência dos starter decks só existe fora de produção.')
  }
}

/** O prefixo que identifica um starter deck. A fonte grafa `ST-01` e `ST13`. */
function ehStarterDeck(code: string): boolean {
  return /^ST-?\d+$/i.test(code.trim())
}

export interface StarterDeckCardRow {
  cardCode: string
  cardName: string
  rarity: string | null
  imageUrl: string | null
  /** Quantas a pessoa já informou. Zero quer dizer "ainda não disse". */
  copias: number
}

export interface StarterDeckRow {
  /** O código do set, como a fonte publicou. É a chave da tabela. */
  code: string
  displayCode: string
  displayName: string
  /**
   * Os líderes do produto, que **não** se confere.
   *
   * Uma cópia de cada: 1 nos decks normais, 3 no ST-10 e no ST-13, que é o que
   * a caixa traz ("Constructed Deck x1 (51 cards), Alternative Leader Card x2").
   */
  leaders: StarterDeckCardRow[]
  /** As cartas que somam 50. É o que a conferência preenche. */
  cards: StarterDeckCardRow[]
  /** Quantas faltam para 50. Zero é o deck fechado; negativo passou. */
  faltam: number
  /** Conferido quando a soma fecha em 50. */
  conferido: boolean
}

export interface StarterDecksWorksheet {
  decks: StarterDeckRow[]
  /** Quantos decks ainda não fecham em 50. */
  faltam: number
  total: number
}

export async function readStarterDecksWorksheet(
  prisma: PrismaClient,
  path: string = STARTER_DECKS_PATH,
): Promise<StarterDecksWorksheet> {
  exigirDesenvolvimento()

  const tabela = new Map(
    loadStarterDecks(path).map((entry) => [
      entry.deck,
      new Map(entry.cartas.map((linha) => [linha.carta, linha.copias])),
    ]),
  )

  const sets = (await prisma.set.findMany({ select: { id: true, code: true, name: true } }))
    .filter((set) => ehStarterDeck(set.code))
    .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }))

  /*
   * Uma consulta so para todos os decks: sao 36 sets e algumas centenas de
   * impressoes. Uma por deck seria o N+1 classico, e esta tela abre inteira.
   */
  const printings = await prisma.variantPrinting.findMany({
    where: { setId: { in: sets.map((set) => set.id) } },
    select: {
      setId: true,
      cardVariant: {
        select: {
          rarity: true,
          imageUrl: true,
          card: { select: { id: true, code: true, name: true, type: true } },
        },
      },
    },
  })

  const porSet = new Map<string, Map<string, StarterDeckCardRow & { type: string }>>()
  for (const printing of printings) {
    const chave = String(printing.setId)
    const carta = printing.cardVariant.card
    const existente = porSet.get(chave) ?? new Map()

    /*
     * Uma linha por **carta**, e nao por arte: o produto traz a carta, e uma
     * mesma carta pode ter duas artes impressas no mesmo ST. Duas linhas
     * pediriam a mesma contagem duas vezes.
     *
     * A primeira arte com imagem e a que ilustra, e a ordem vem do banco: nao
     * ha "a" arte do produto, e escolher por raridade seria inventar criterio.
     */
    const anterior = existente.get(carta.code)
    if (!anterior || (anterior.imageUrl === null && printing.cardVariant.imageUrl !== null)) {
      existente.set(carta.code, {
        cardCode: carta.code,
        cardName: carta.name,
        rarity: printing.cardVariant.rarity,
        imageUrl: printing.cardVariant.imageUrl,
        type: carta.type,
        copias: 0,
      })
    }
    porSet.set(chave, existente)
  }

  const decks = sets.map((set): StarterDeckRow => {
    const conferidas = tabela.get(set.code)
    const todas = [...(porSet.get(String(set.id))?.values() ?? [])].sort((a, b) =>
      a.cardCode.localeCompare(b.cardCode, 'en'),
    )

    const leaders = todas
      .filter((carta) => carta.type === 'Leader')
      .map(({ type, ...resto }) => {
        void type
        return { ...resto, copias: 1 }
      })

    const cards = todas
      .filter((carta) => carta.type !== 'Leader')
      .map(({ type, ...resto }) => {
        void type
        return { ...resto, copias: conferidas?.get(resto.cardCode) ?? 0 }
      })

    const faltam = missingForDeck(cards)

    return {
      code: set.code,
      displayCode: displaySetCode(set.code),
      displayName: displaySetName(set.name),
      leaders,
      cards,
      faltam,
      conferido: faltam === 0 && cards.length > 0,
    }
  })

  return {
    decks,
    faltam: decks.filter((deck) => !deck.conferido).length,
    total: decks.length,
  }
}

/**
 * Grava as cópias de um deck.
 *
 * Lista vazia **apaga** a linha da tabela, e isso é o "ainda não conferi" de
 * volta — não um deck de zero cartas.
 *
 * O caso de uso não mexe no banco: o arquivo é a verdade, e quem o aplicar
 * depois — o "Adicionar ST" — lê dele.
 */
export async function recordStarterDeck(
  prisma: PrismaClient,
  deck: string,
  cartas: readonly StarterDeckCopies[],
  path: string = STARTER_DECKS_PATH,
): Promise<void> {
  exigirDesenvolvimento()

  const code = deck.trim()
  if (code === '') throw new ValidationError('Deck não informado.')

  const set = await prisma.set.findFirst({ where: { code }, select: { id: true } })
  if (!set || !ehStarterDeck(code)) {
    throw new NotFoundError(`${code} não é um starter deck do catálogo.`)
  }

  const informadas = cartas
    .map((linha) => ({ carta: linha.carta.trim(), copias: linha.copias }))
    .filter((linha) => linha.carta !== '' && linha.copias > 0)

  if (informadas.length > 0) {
    /*
     * Toda carta informada precisa estar impressa neste deck. Sem esta
     * checagem, um codigo digitado errado entraria na tabela e so apareceria no
     * dia em que alguem clicasse em "Adicionar ST" — e ai ja estaria na colecao
     * de alguem.
     */
    const impressas = await prisma.variantPrinting.findMany({
      where: { setId: set.id, cardVariant: { card: { code: { in: informadas.map((l) => l.carta) } } } },
      select: { cardVariant: { select: { card: { select: { code: true, type: true } } } } },
    })

    const conhecidas = new Map(
      impressas.map((p) => [p.cardVariant.card.code, p.cardVariant.card.type]),
    )

    for (const linha of informadas) {
      const tipo = conhecidas.get(linha.carta)
      if (tipo === undefined) {
        throw new ValidationError(`A carta ${linha.carta} não está impressa em ${code}.`)
      }
      if (tipo === 'Leader') {
        throw new ValidationError(
          `O líder ${linha.carta} não entra na conta: ele é uma cópia de cada, sempre.`,
        )
      }
    }
  }

  const tabela = loadStarterDecks(path).filter((entry) => entry.deck !== code)
  const proxima: StarterDeckEntry[] =
    informadas.length > 0 ? [...tabela, { deck: code, cartas: informadas }] : tabela

  // `validateStarterDecks` e quem exige a soma de 50: a tela ja impede, e isto
  // recusa quem chamar a acao sem ela.
  saveStarterDecks(validateStarterDecks(proxima), path)
}

export { STARTER_DECK_CARDS }
