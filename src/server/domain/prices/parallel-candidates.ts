import { compareSetsForCatalog } from '@/server/domain/catalog/sets'
import { artNumber } from '@/server/domain/catalog/order'
import { ligaIdentity } from '@/server/domain/prices/liga-treatment'
import { ligaSuggestion } from '@/server/domain/prices/liga-suggestion'

/**
 * As cartas que a tela `/dev/paralelas` pergunta (decisões 068 e 077).
 *
 * Camada: domain. Puro.
 *
 * ## O que é pergunta
 *
 * Uma carta entra quando alguma arte dela tem um motivo:
 *
 * - **`sem-vinculo`** — paralela sem vínculo;
 * - **`liga-sugere-outro`** — a página da Liga aponta outro produto que não o
 *   vinculado (`ligaSuggestion`), de qualquer origem: o manual também erra;
 * - **`normal-sem-preco`** — a normal que a regra da arte comum não cotou. São
 *   quase todas promos `P-`, que o TCGplayer vende com nome de evento.
 *
 * Com a carta entram **todas** as paralelas dela e **todos** os produtos, com o
 * dono de cada um. Trocas entre irmãs — três artes deslocadas uma posição, como a
 * `OP06-056` — só se desfazem vendo a carta inteira.
 *
 * ## Resposta `null` conta como respondida
 *
 * `produto: null` no arquivo é "olhei, e a fonte não tem esta arte". Se ela não
 * contasse, a arte voltaria para a fila a cada levantamento (decisão 068). Pelo
 * mesmo motivo, manter o vínculo contra a sugestão da Liga grava a nota
 * `MANTIDO_CONTRA_A_LIGA`, e a arte não volta. Quem decide se já foi respondida
 * é `candidateAnswered`, com o arquivo de agora: a arte respondida continua no
 * levantamento, e a tela a mostra em "Todas".
 */

export const MANTIDO_CONTRA_A_LIGA = 'revisado: mantido contra a sugestão da Liga'

export type CandidateReason = 'sem-vinculo' | 'liga-sugere-outro' | 'normal-sem-preco'

export interface CandidateOurArt {
  /** O `source_id` da Bandai: é por ele que o arquivo manual identifica a arte. */
  sourceId: string
  variantType: 'Normal' | 'Parallel'
  rarity: string | null
  imageUrl: string | null
  /** Por que a arte está na tela; `null` é a irmã que só vem junto. */
  motivo: CandidateReason | null
  /** O vínculo de hoje. */
  atual: { productId: string; origin: 'automatic' | 'manual' } | null
  /** A página conferida na Liga, e o tratamento que se lê dela. */
  liga: { url: string; tratamento: string | null } | null
  /** O produto que a página da Liga aponta, quando é outro que não o de hoje. */
  sugestao: string | null
}

export interface CandidateSourceArt {
  productId: string
  /** O tratamento, como a fonte escreve: `Alternate Art`, `Manga`, `Event Pack Vol. 2`. */
  label: string
  /** Preço de mercado em dólar, quando a fonte cota. Ajuda a reconhecer a arte. */
  value: number | null
  /** O grupo do TCGplayer: `OP01`, `PRB-01`, `OP-PR`. */
  groupCode: string | null
  /** O `source_id` que segura o produto hoje. */
  dono: string | null
}

export interface ParallelCandidate {
  cardCode: string
  cardName: string
  setCode: string | null
  ours: CandidateOurArt[]
  theirs: CandidateSourceArt[]
}

export interface CandidateInputArt {
  sourceId: string
  variantType: 'Normal' | 'Parallel'
  rarity: string | null
  imageUrl: string | null
  sets: readonly string[]
  atual: { productId: string; origin: 'automatic' | 'manual' } | null
  ligaUrl: string | null | undefined
}

export interface CandidateInputCard {
  code: string
  name: string
  setCode: string | null
  arts: readonly CandidateInputArt[]
}

export interface CandidatesInput {
  cards: readonly CandidateInputCard[]
  /** As respostas do arquivo manual, por `source_id`, com a nota. */
  manual: ReadonlyMap<string, { produto: string | null; nota?: string }>
  /** Os produtos da fonte por código de carta em maiúsculas, já com o dono. */
  productsByCode: ReadonlyMap<string, readonly CandidateSourceArt[]>
  /** As normais que a importação cotou. */
  pricedNormals: ReadonlySet<string>
}

export function mappingCandidates(input: CandidatesInput): ParallelCandidate[] {
  const cartas: ParallelCandidate[] = []

  for (const card of input.cards) {
    const theirs = input.productsByCode.get(card.code.toUpperCase()) ?? []
    if (theirs.length === 0) continue

    const normal = card.arts.find((art) => art.variantType === 'Normal')
    const paralelas = card.arts.filter((art) => art.variantType === 'Parallel')
    const comoLiga = (art: CandidateInputArt) => ({
      sourceId: art.sourceId,
      cardCode: card.code,
      cardName: card.name,
      ligaUrl: art.ligaUrl,
      rarity: art.rarity,
      parallelSets: art.sets,
      normalSets: normal?.sets ?? [],
    })
    const irmas = paralelas.map(comoLiga)

    const ours: CandidateOurArt[] = []
    for (const art of paralelas) {
      const resposta = input.manual.get(art.sourceId)
      const sugestao = ligaSuggestion(comoLiga(art), art.atual?.productId ?? null, theirs, irmas)

      let motivo: CandidateReason | null = null
      if (art.atual === null) motivo = 'sem-vinculo'
      else if (sugestao !== null && resposta?.nota !== MANTIDO_CONTRA_A_LIGA) motivo = 'liga-sugere-outro'

      ours.push({
        sourceId: art.sourceId,
        variantType: 'Parallel',
        rarity: art.rarity,
        imageUrl: art.imageUrl,
        motivo,
        atual: art.atual,
        liga: art.ligaUrl ? { url: art.ligaUrl, tratamento: ligaIdentity(comoLiga(art)).tratamento } : null,
        sugestao,
      })
    }

    if (normal && !input.pricedNormals.has(normal.sourceId)) {
      ours.push({
        sourceId: normal.sourceId,
        variantType: 'Normal',
        rarity: normal.rarity,
        imageUrl: normal.imageUrl,
        motivo: 'normal-sem-preco',
        atual: normal.atual,
        liga: normal.ligaUrl ? { url: normal.ligaUrl, tratamento: null } : null,
        sugestao: null,
      })
    }

    if (!ours.some((art) => art.motivo !== null)) continue
    ours.sort((a, b) => artNumber(a.sourceId) - artNumber(b.sourceId))
    cartas.push({ cardCode: card.code, cardName: card.name, setCode: card.setCode, ours, theirs: [...theirs] })
  }

  // A ordem do catalogo — lancamento, promos no fim (decisao 040) —, que e a
  // ordem em que quem joga reconhece as colecoes.
  return cartas.sort((a, b) => {
    const set = compareSetsForCatalog(a.setCode, b.setCode)
    if (set !== 0) return set
    return a.cardCode < b.cardCode ? -1 : a.cardCode > b.cardCode ? 1 : 0
  })
}

/**
 * Se a pergunta de uma arte já tem resposta, com o arquivo manual de agora — o
 * levantamento é um retrato, e a tela precisa saber do que se gravou depois.
 */
export function candidateAnswered(
  art: CandidateOurArt,
  manual: Readonly<Record<string, { produto: string | null; nota?: string }>>,
): boolean {
  const resposta = manual[art.sourceId]
  if (art.motivo === null) return true
  if (art.motivo !== 'liga-sugere-outro') return resposta !== undefined
  if (!resposta) return false
  return resposta.produto === art.sugestao || resposta.nota === MANTIDO_CONTRA_A_LIGA
}
