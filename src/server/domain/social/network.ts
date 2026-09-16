import { ValidationError } from '@/server/domain/errors'

/**
 * A rede: em que ordem as pessoas aparecem, o que a prévia mostra, e os limites
 * que contêm a raspagem (regras 6.1.2 a 6.1.4, decisões 060 e 079).
 *
 * Camada: domain. Puro.
 */

/** Pessoas por página. Dez caixas com prévia cabem numa rolagem de celular sem pesar. */
export const NETWORK_PAGE_SIZE = 10

/**
 * Quantas páginas se pode pedir, no máximo.
 *
 * A decisão 060 pede teto de profundidade: sem ele, paginar é raspar devagar.
 * Vinte páginas são duzentas pessoas — mais do que alguém percorre olhando, e a
 * busca por carta é o caminho para o resto.
 */
export const NETWORK_MAX_PAGES = 20

/** Cartas na prévia de cada pessoa, no desenho do dono do produto: seis ou sete. */
export const NETWORK_PREVIEW_SIZE = 7

/** A busca por carta precisa de algo para buscar: uma letra casaria o catálogo inteiro. */
export const NETWORK_QUERY_MIN = 2

export const REPORT_REASON_MAX = 1000

export interface NetworkRanking {
  username: string
  premium: boolean
  /** Quantas cartas do Trade Binder dela quem olha ainda procura. */
  interest: number
}

/**
 * A ordem da rede (regra 6.1.3): Premium primeiro; no empate, quem tem mais
 * cartas que interessam a quem olha. O nome desempata o resto, para a ordem não
 * mudar entre um carregamento e outro.
 */
export function compareNetworkMembers(a: NetworkRanking, b: NetworkRanking): number {
  if (a.premium !== b.premium) return a.premium ? -1 : 1
  if (a.interest !== b.interest) return b.interest - a.interest
  return a.username < b.username ? -1 : a.username > b.username ? 1 : 0
}

/**
 * A página pedida, dentro do teto. Página inválida vira a primeira, e página
 * além do teto vira a última permitida — responder erro a um número na URL
 * seria pior que mostrar o que se pode.
 */
export function clampNetworkPage(raw: string | number | null | undefined): number {
  const page = typeof raw === 'number' ? raw : Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(page) || page < 1) return 1
  return Math.min(Math.trunc(page), NETWORK_MAX_PAGES)
}

/** O texto da busca, ou `null` quando não há busca. Curto demais também é "não há". */
export function normalizeNetworkQuery(raw: string | null | undefined): string | null {
  const query = (raw ?? '').trim().replace(/\s+/g, ' ')
  return query.length >= NETWORK_QUERY_MIN ? query.slice(0, 60) : null
}

/**
 * As cartas da prévia.
 *
 * Com busca, primeiro as que casam com ela — é o que a pessoa pediu para ver, e
 * medido nos dados locais uma want list grande enchia as sete vagas antes delas.
 * Depois as que quem olha procura, que é o motivo de a pessoa estar no alto da
 * lista; depois o resto, na ordem em que chegaram (a do catálogo).
 */
export function previewCards<T extends { variantId: string }>(
  cards: readonly T[],
  highlight: { wanted: ReadonlySet<string>; matching?: ReadonlySet<string> },
  size: number = NETWORK_PREVIEW_SIZE,
): T[] {
  const peso = (card: T) => {
    const casa = highlight.matching?.has(card.variantId) ?? false
    const quero = highlight.wanted.has(card.variantId)
    if (casa) return quero ? 0 : 1
    return quero ? 2 : 3
  }
  return cards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => peso(a.card) - peso(b.card) || a.index - b.index)
    .slice(0, size)
    .map((entrada) => entrada.card)
}

/** O motivo da denúncia: obrigatório, e com teto. */
export function normalizeReportReason(raw: string | null | undefined): string {
  const reason = (raw ?? '').trim()
  if (reason.length === 0) {
    throw new ValidationError('Conte o que aconteceu: a denúncia precisa de um motivo.')
  }
  if (reason.length > REPORT_REASON_MAX) {
    throw new ValidationError(`O motivo passou de ${REPORT_REASON_MAX} caracteres.`)
  }
  return reason
}
