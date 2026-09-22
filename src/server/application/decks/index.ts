import { prisma } from '@/server/infrastructure/prisma'
import type { AuthenticatedUser } from '@/server/application/auth'
import { analyzeDeck as analyzeDeckWith, type DeckInput } from './analyze-deck'
import {
  deleteDeck as deleteDeckWith,
  listDecks as listDecksWith,
  readDeck as readDeckWith,
  saveDeck as saveDeckWith,
  type SavedDeckInput,
} from './saved-decks'

/**
 * Ponto de composição do Deck Builder (decisão 095).
 *
 * Camada: application, a única que pode falar com infrastructure.
 *
 * Só leitura: a conferência não guarda deck nenhum. Quem acrescenta o que falta
 * à want list é o caso de uso de wants, que já existia.
 */
export function analyzeDeck(user: AuthenticatedUser, input: DeckInput) {
  return analyzeDeckWith(prisma, user, input)
}

/* As decklists salvas (decisão 108, que muda a 095). */

export function saveDeck(user: AuthenticatedUser, input: SavedDeckInput) {
  return saveDeckWith(prisma, user, input)
}

export function listDecks(user: AuthenticatedUser) {
  return listDecksWith(prisma, user)
}

export function readDeck(user: AuthenticatedUser, id: string) {
  return readDeckWith(prisma, user, id)
}

export function deleteDeck(user: AuthenticatedUser, id: string) {
  return deleteDeckWith(prisma, user, id)
}

export type {
  DeckAnalysis,
  DeckAnalysisLine,
  DeckInput,
  DeckPlace,
} from './analyze-deck'
export type { SavedDeck, SavedDeckInput, SavedDeckSummary } from './saved-decks'
/* As 51 moram no domínio: a tela precisa delas, e o domínio é puro. */
export { DECK_TOTAL_WITH_LEADER } from '@/server/domain/decks/deck'
export { DECK_SIZE, MAX_COPIES_PER_CARD } from '@/server/domain/decks/deck'
