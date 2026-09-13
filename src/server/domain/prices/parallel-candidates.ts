import { compareSetsForCatalog } from '@/server/domain/catalog/sets'

/**
 * O que ainda falta mapear à mão.
 *
 * Camada: domain. Puro.
 *
 * ## O que é pendente
 *
 * Uma carta está pendente quando sobra, **dos dois lados**, algo sem par:
 *
 * - do nosso, uma paralela sem vínculo e sem resposta no arquivo manual;
 * - da fonte, uma arte que nenhum vínculo reivindicou.
 *
 * Os dois lados, porque um só não é pergunta. Paralela nossa sem produto
 * disponível é "a fonte não oferece" — não há o que escolher, e oferecer à pessoa
 * uma carta sem opção nenhuma seria fazê-la olhar à toa. Produto sobrando sem
 * paralela nossa é arte que o nosso catálogo não tem, e também não se mapeia.
 *
 * ## Resposta `null` conta como respondida
 *
 * `produto: null` no arquivo é "olhei, e a fonte não tem esta arte". Se ela não
 * contasse, a arte voltaria para a fila a cada levantamento, e a pessoa refaria o
 * mesmo julgamento para sempre (decisão 068).
 */

export interface CandidateOurArt {
  /** O `source_id` da Bandai: é por ele que o arquivo manual identifica a arte. */
  sourceId: string
  rarity: string | null
  imageUrl: string | null
}

export interface CandidateSourceArt {
  productId: string
  /** O tratamento, como a fonte escreve: `Alternate Art`, `Manga`. */
  label: string
  /** Preço de mercado em dólar, quando a fonte cota. Ajuda a reconhecer a arte. */
  value: number | null
}

export interface ParallelCandidate {
  cardCode: string
  cardName: string
  setCode: string | null
  ours: CandidateOurArt[]
  theirs: CandidateSourceArt[]
}

export interface CardWithParallels {
  code: string
  name: string
  setCode: string | null
  parallels: readonly CandidateOurArt[]
}

export interface PendingInput {
  cards: readonly CardWithParallels[]
  /** `source_id` das nossas paralelas que já têm vínculo, de qualquer origem. */
  linkedSourceIds: ReadonlySet<string>
  /** Produtos da fonte que algum vínculo já segura. */
  claimedProductIds: ReadonlySet<string>
  /** `source_id` respondidos no arquivo manual, com produto ou com `null`. */
  answeredSourceIds: ReadonlySet<string>
  /** As artes da fonte, por código de carta em maiúsculas. */
  artsByCode: ReadonlyMap<string, readonly CandidateSourceArt[]>
}

export function pendingParallels(input: PendingInput): ParallelCandidate[] {
  const pendentes: ParallelCandidate[] = []

  for (const card of input.cards) {
    const ours = card.parallels.filter(
      (art) => !input.linkedSourceIds.has(art.sourceId) && !input.answeredSourceIds.has(art.sourceId),
    )
    const theirs = (input.artsByCode.get(card.code.toUpperCase()) ?? []).filter(
      (art) => !input.claimedProductIds.has(art.productId),
    )

    if (ours.length > 0 && theirs.length > 0) {
      pendentes.push({ cardCode: card.code, cardName: card.name, setCode: card.setCode, ours, theirs })
    }
  }

  // A ordem do catalogo — lancamento, promos no fim (decisao 040) —, que e a
  // ordem em que quem joga reconhece as colecoes.
  return pendentes.sort((a, b) => {
    const set = compareSetsForCatalog(a.setCode, b.setCode)
    if (set !== 0) return set
    return a.cardCode < b.cardCode ? -1 : a.cardCode > b.cardCode ? 1 : 0
  })
}
