import { prisma } from '@/server/infrastructure/prisma'
import type { AuthenticatedUser } from '@/server/application/auth'
import { analyzeDeck as analyzeDeckWith, type DeckInput } from './analyze-deck'

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

export type {
  DeckAnalysis,
  DeckAnalysisLine,
  DeckInput,
  DeckPlace,
} from './analyze-deck'
export { DECK_SIZE, MAX_COPIES_PER_CARD } from '@/server/domain/decks/deck'
