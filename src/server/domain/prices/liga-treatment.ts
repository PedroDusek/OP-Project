/**
 * Casar as nossas paralelas com os produtos do TCGplayer pelo tratamento que a
 * Liga conferida nomeia (decisão 072).
 *
 * Camada: domain. Puro.
 *
 * ## Por que funciona
 *
 * A Liga escreve o tratamento de cada arte com os mesmos nomes do TCGplayer —
 * `Sanji (Alternate Art)`, `Izo (033) (Jolly Roger Foil)`, `Nami (SP)` —, e o
 * dono do produto conferiu a página da Liga de cada arte nossa
 * (`data/liga-cartas.json`, decisão 071). A arte deixa de ser "uma das três
 * paralelas indistinguíveis" (decisão 023) e passa a ter nome.
 *
 * Casa quando o tratamento que a Liga dá à arte é **igual** ao de **exatamente
 * um** produto da carta, e **só uma** arte nossa da carta tem aquele tratamento.
 * Igualdade do conjunto de partes, e não semelhança: `SP + Gold` não é `SP`.
 *
 * Medido em 15/09/2026, contra os vínculos que já existiam: a regra concordou em
 * 513 de 513. As 30 divergências eram as reimpressões abaixo.
 *
 * ## A reimpressão da PRB vale como Pirate Foil
 *
 * Instrução do dono do produto. Na Liga, `(Reprint)` é a carta original
 * reimpressa na PRB — praticamente a mesma carta, mudando o produto de onde saiu.
 * Quando a normal da carta já está impressa no mesmo set da paralela, o preço que
 * o TCGplayer cota para essa versão é o da **Pirate Foil**, e é para ela que o
 * vínculo vai. O endereço da Liga continua sendo o que foi conferido.
 *
 * ## O que fica de fora, de propósito
 *
 * - Nome da Liga sem tratamento — a SP de outra coleção (`Trafalgar Law
 *   (OP01-047)` em `OP-04`) só é `SP` porque a nossa raridade diz `SP CARD`; sem
 *   ela, não há o que casar.
 * - Duas artes nossas com o mesmo tratamento — as páginas da Liga que valem para
 *   mais de uma arte. Um produto não pode ter dois donos.
 * - Dois produtos com o mesmo tratamento — a `(Reprint)` que saiu na PRB e num
 *   starter deck. O nome não distingue; o olho distingue.
 */

export interface LigaArt {
  variantId: string
  /** O endereço conferido na Liga, quando há. */
  ligaUrl: string | null | undefined
  rarity: string | null
  /** O nome da carta no nosso catálogo: tirado antes de ler os parênteses. */
  cardName: string
  /** Os sets desta paralela e da normal da carta — para a reimpressão da PRB. */
  parallelSets: readonly string[]
  normalSets: readonly string[]
}

export interface SourceProductOption {
  productId: string
  /** O tratamento como a fonte escreve: `Alternate Art`, `SP + Gold`, `Reprint`. */
  label: string
}

export interface LigaPair {
  variantId: string
  productId: string
}

/** Partes em minúsculas, sem repetição, em ordem: `SP + Gold` e `Gold + SP` são iguais. */
export function treatmentKey(parts: readonly string[]): string {
  return [...new Set(parts.map((part) => part.trim().toLowerCase()).filter(Boolean))].sort().join(' + ')
}

export function sourceTreatmentKey(label: string): string {
  return treatmentKey(label.split('+'))
}

/**
 * O tratamento que a Liga dá à arte, já na forma de comparar, ou `null` quando
 * não dá para saber.
 */
export function ligaTreatmentKey(art: Omit<LigaArt, 'variantId'>): string | null {
  if (!art.ligaUrl) return null

  let params: URLSearchParams
  try {
    params = new URL(art.ligaUrl).searchParams
  } catch {
    return null
  }

  // O "(OP01-001-PAR)" do fim e o codigo, e nao tratamento.
  let nome = (params.get('card') ?? '').replace(/\s*\([^()]*\)\s*$/, '')
  // O nome primeiro: `Mr.5(Gem)` e o personagem, e o `(Gem)` nao e tratamento.
  if (art.cardName && nome.startsWith(art.cardName)) nome = nome.slice(art.cardName.length)

  const partes = [...nome.matchAll(/\(([^()]*)\)/g)]
    .map((match) => match[1])
    // `(033)` desambigua cartas de mesmo nome na Liga.
    .filter((parte) => !/^\s*\d{3}\s*$/.test(parte))

  if (partes.length === 0) {
    if (/-PAR$/i.test(params.get('num') ?? '')) return 'parallel'
    if ((art.rarity ?? '').trim().toUpperCase() === 'SP CARD') return 'sp'
    return null
  }

  const chave = treatmentKey(partes)
  if (chave === 'reprint' && art.parallelSets.some((set) => art.normalSets.includes(set))) {
    return 'pirate foil'
  }
  return chave
}

/**
 * Os pares que o tratamento da Liga decide numa carta. O que não casa volta para
 * as regras seguintes — raridade (068) e o caso sem escolha (053).
 */
export function deduceByLigaTreatment(
  ours: readonly LigaArt[],
  theirs: readonly SourceProductOption[],
): LigaPair[] {
  const chaves = ours
    .map((art) => ({ art, chave: ligaTreatmentKey(art) }))
    .filter((item): item is { art: LigaArt; chave: string } => item.chave !== null)

  const quantasNossas = new Map<string, number>()
  for (const { chave } of chaves) quantasNossas.set(chave, (quantasNossas.get(chave) ?? 0) + 1)

  const pares: LigaPair[] = []
  for (const { art, chave } of chaves) {
    if (quantasNossas.get(chave) !== 1) continue
    const produtos = theirs.filter((produto) => sourceTreatmentKey(produto.label) === chave)
    if (produtos.length !== 1) continue
    pares.push({ variantId: art.variantId, productId: produtos[0].productId })
  }
  return pares
}
