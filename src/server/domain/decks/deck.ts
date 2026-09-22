import { ValidationError } from '@/server/domain/errors'

/**
 * As regras de um deck de One Piece (decisão 095).
 *
 * Camada: domain. Puro: conta, confere e reparte — não sabe de banco nem de tela.
 *
 * O ColeXa **não guarda deck**: isto é uma conferência. A pessoa monta a lista,
 * o produto diz o que ela tem, onde está e quanto custa o que falta — escolha do
 * dono do produto, e é por isso que não há tabela nenhuma aqui.
 */

/** Um líder e cinquenta cartas. O líder não entra na conta das cinquenta. */
export const DECK_SIZE = 50

/**
 * As 51: o líder é conferido junto (regra 7).
 *
 * Mora no domínio, e não na camada de aplicação, porque **a tela precisa dele** —
 * é o total da barra de progresso das decklists. Importá-lo de `application`
 * arrastaria o Prisma para dentro de um componente, que é a fronteira que o
 * lint do projeto existe para proteger.
 */
export const DECK_TOTAL_WITH_LEADER = DECK_SIZE + 1

/**
 * Quatro cópias por **código**, e não por arte: a regra oficial conta a carta, e
 * duas artes da mesma carta são a mesma carta para o deck.
 */
export const MAX_COPIES_PER_CARD = 4

export interface DeckLine {
  /** A variante escolhida: é dela que sai o preço do que falta. */
  variantId: string
  cardCode: string
  copies: number
}

/**
 * A carta serve a este líder?
 *
 * A regra oficial: a carta precisa ter **alguma** cor do líder. Líder de duas
 * cores aceita as duas, e carta de duas cores entra se uma delas bater.
 */
export function fitsLeader(leaderColors: readonly string[], cardColors: readonly string[]): boolean {
  return cardColors.some((color) => leaderColors.includes(color))
}

/** Quantas cópias o deck tem de cada código, somando as artes. */
export function copiesByCode(lines: readonly DeckLine[]): Map<string, number> {
  const total = new Map<string, number>()
  for (const line of lines) {
    total.set(line.cardCode, (total.get(line.cardCode) ?? 0) + line.copies)
  }
  return total
}

/** O total de cartas do deck, sem o líder. */
export function deckTotal(lines: readonly DeckLine[]): number {
  return lines.reduce((soma, line) => soma + line.copies, 0)
}

/**
 * Recusa o que não pode ser jogado — escolha do dono do produto: impedir, e não
 * avisar. O total de cinquenta é a única coisa que fica como contagem, porque um
 * deck em construção passa a maior parte do tempo incompleto.
 */
export function assertDeckRules(lines: readonly DeckLine[]): void {
  for (const line of lines) {
    if (!Number.isInteger(line.copies) || line.copies < 1) {
      throw new ValidationError('Cada carta entra com pelo menos uma cópia.')
    }
  }

  for (const [code, copies] of copiesByCode(lines)) {
    if (copies > MAX_COPIES_PER_CARD) {
      throw new ValidationError(
        `${code}: o deck aceita no máximo ${MAX_COPIES_PER_CARD} cópias da mesma carta, somando as artes.`,
      )
    }
  }

  if (deckTotal(lines) > DECK_SIZE) {
    throw new ValidationError(`O deck tem ${DECK_SIZE} cartas, e a lista passou disso.`)
  }
}

export interface LineMatch {
  /** Quantas destas cópias a pessoa já tem. */
  owned: number
  /** Quantas ainda faltam comprar. */
  missing: number
}

/**
 * Reparte o que a pessoa tem entre as linhas do deck.
 *
 * Com o **auto completar ligado**, as cópias de qualquer arte da mesma carta
 * servem, e por isso o que existe é um bolo por código: as primeiras linhas são
 * cobertas até acabar. Desligado, cada linha só é coberta pela arte exata que a
 * pessoa escolheu.
 *
 * Repartir importa porque o preço do que falta é o da arte escolhida (decisão
 * 095): quem pediu duas cópias de uma arte cara e duas de uma barata precisa
 * saber qual delas ficou faltando.
 */
export function distributeOwned(
  lines: readonly DeckLine[],
  ownedByVariant: ReadonlyMap<string, number>,
  ownedByCode: ReadonlyMap<string, number>,
  autoComplete: boolean,
): LineMatch[] {
  if (!autoComplete) {
    return lines.map((line) => {
      const owned = Math.min(line.copies, ownedByVariant.get(line.variantId) ?? 0)
      return { owned, missing: line.copies - owned }
    })
  }

  const restante = new Map(ownedByCode)
  return lines.map((line) => {
    const disponivel = restante.get(line.cardCode) ?? 0
    const owned = Math.min(line.copies, disponivel)
    restante.set(line.cardCode, disponivel - owned)
    return { owned, missing: line.copies - owned }
  })
}
