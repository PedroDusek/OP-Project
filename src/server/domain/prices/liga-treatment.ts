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
 * - Dois produtos com o mesmo tratamento **em edições que a Liga não distingue** —
 *   os pacotes de torneio com três produtos de nome idêntico no mesmo grupo.
 *
 * ## A edição da Liga desempata (15/09)
 *
 * A página da Liga diz a edição (`ed=PRB2`, `ed=ST31`), e o TCGplayer agrupa o
 * produto pela coleção onde ele saiu (`PRB-02`, `ST-31`). Duas coisas passam a
 * casar por ela:
 *
 * - **dois produtos com o mesmo tratamento** — a `(Reprint)` que saiu na PRB-02 e
 *   no ST-24 — ficam com o do grupo da edição;
 * - **a página sem tratamento** — a Nami `OP01-016` na edição `ST31` — casa com o
 *   produto sem tratamento do grupo daquela coleção. **Nunca na coleção da própria
 *   carta**: ali o produto sem tratamento é a normal. Medido na primeira passada —
 *   a `OP01-008_p1`, Box Topper, trocou o vínculo certo pelo da normal de US$ 0,10.
 *
 * A edição só decide quando corresponde a um grupo sem ambiguidade
 * (`editionMatchesGroup`). As que não têm par claro — `PC-01`, `LTDS`, `OP-13-TA`
 * — não decidem nada.
 *
 * ## Pontuação não distingue tratamento
 *
 * A Liga escreve `ST15 ST20 Release Event Pack`; o TCGplayer, `ST15 - ST20
 * Release Event Pack`. As partes são comparadas só por letras e números.
 */

import { isOwnSet } from '@/server/domain/catalog/order'

export interface LigaArt {
  variantId: string
  /** O código da carta: a página sem tratamento na coleção da própria carta é a normal. */
  cardCode: string
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
  /** A abreviação do grupo do TCGplayer onde o produto saiu: `PRB-02`, `ST-31`. */
  groupCode?: string | null
}

export interface LigaPair {
  variantId: string
  productId: string
}

/**
 * Partes em minúsculas, só letras e números, sem repetição, em ordem: `SP + Gold`
 * e `Gold + SP` são iguais, e `ST15 - ST20` é `ST15 ST20`.
 */
export function treatmentKey(parts: readonly string[]): string {
  const limpas = parts.map((part) => part.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).filter(Boolean)
  return [...new Set(limpas)].sort().join(' + ')
}

/**
 * O código de uma edição ou grupo em partes comparáveis: coleções com número
 * (`OP14`, `EB3`, `PRB2`) e palavras soltas (`RE`, `PRE`).
 *
 * `EB-03-04` é `EB3` e `EB4`. `PRB` sem número é a primeira (`PRB1`). `PR` é
 * `PRE`, o pré-lançamento — a Liga escreve `OP-02-PR`, o TCGplayer `OP02 PRE`.
 */
function editionParts(code: string): { sets: Set<string>; words: Set<string> } {
  const sets = new Set<string>()
  const words = new Set<string>()
  const partes = code.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean)
  let prefixo: string | null = null

  for (let i = 0; i < partes.length; i++) {
    const parte = partes[i]
    const comNumero = /^([A-Z]+)(\d+)$/.exec(parte)
    if (comNumero) {
      prefixo = comNumero[1]
      sets.add(`${comNumero[1]}${Number(comNumero[2])}`)
    } else if (/^\d+$/.test(parte)) {
      if (prefixo) sets.add(`${prefixo}${Number(parte)}`)
    } else if (i + 1 < partes.length && /^\d+$/.test(partes[i + 1])) {
      prefixo = parte
    } else if (parte === 'PRB') {
      sets.add('PRB1')
    } else {
      words.add(parte === 'PR' ? 'PRE' : parte)
    }
  }
  return { sets, words }
}

/**
 * A edição da Liga corresponde ao grupo do TCGplayer: toda coleção da edição está
 * no grupo, e as palavras soltas são as mesmas — `OP-15` é `OP15-EB04`, e não
 * `OP15 RE`.
 */
export function editionMatchesGroup(ligaEdition: string | null | undefined, groupCode: string | null | undefined): boolean {
  if (!ligaEdition || !groupCode) return false
  const ed = editionParts(ligaEdition)
  const grupo = editionParts(groupCode)
  if (ed.sets.size === 0) return false
  if ([...ed.sets].some((set) => !grupo.sets.has(set))) return false
  if (ed.words.size !== grupo.words.size) return false
  return [...ed.words].every((word) => grupo.words.has(word))
}

/**
 * Tira do começo do nome da Liga o nome da carta, comparando só letras e números.
 *
 * A Liga nem sempre escreve o nome como o catálogo: `Mr. 1 (Daz.Bonez)` contra
 * `Mr.1(Daz.Bonez)`. Comparar o texto cru deixava o `(Daz.Bonez)` do nome virar
 * tratamento, e o vínculo certo parecia contradizer a Liga.
 */
function semONomeDaCarta(nomeDaLiga: string, cardName: string): string {
  const alvo = cardName.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!alvo) return nomeDaLiga
  let lido = ''
  for (let i = 0; i < nomeDaLiga.length; i++) {
    const c = nomeDaLiga[i].toLowerCase()
    if (/[a-z0-9]/.test(c)) lido += c
    if (lido === alvo) return nomeDaLiga.slice(i + 1)
    if (!alvo.startsWith(lido)) return nomeDaLiga
  }
  return nomeDaLiga
}

function ligaEditionOf(ligaUrl: string | null | undefined): string | null {
  if (!ligaUrl) return null
  try {
    return new URL(ligaUrl).searchParams.get('ed')
  } catch {
    return null
  }
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
  nome = semONomeDaCarta(nome, art.cardName)

  const partes = [...nome.matchAll(/\(([^()]*)\)/g)]
    .map((match) => match[1])
    // `(033)` desambigua cartas de mesmo nome na Liga — as vezes com outra
    // quantidade de digitos, `(60)` ou `(0070)`.
    .filter((parte) => !/^\s*\d{1,4}\s*$/.test(parte))

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
 * O que a Liga diz que esta arte é, na forma que a regra usa para distinguir as
 * artes de uma carta: o tratamento, ou — sem tratamento — a edição de outra
 * coleção. `null` quando a Liga não diz nada que sirva.
 *
 * Duas artes da mesma carta com a mesma identidade são indistinguíveis para a
 * regra, e nenhuma das duas ganha vínculo por ela. É o que a tela
 * `/dev/liga/repetidas` lista.
 */
export function ligaIdentity(art: Omit<LigaArt, 'variantId'>): {
  tratamento: string | null
  edicao: string | null
  chave: string | null
} {
  const tratamento = ligaTreatmentKey(art)
  const edicao = ligaEditionOf(art.ligaUrl)
  if (tratamento !== null) return { tratamento, edicao, chave: tratamento }
  // Sem tratamento, na colecao da propria carta, a pagina e a da normal: nao identifica.
  if (!edicao || isOwnSet(art.cardCode, edicao)) return { tratamento, edicao, chave: null }
  return { tratamento, edicao, chave: `sem tratamento em ${edicao}` }
}

/**
 * Os pares que o tratamento da Liga decide numa carta. O que não casa volta para
 * as regras seguintes — raridade (068) e o caso sem escolha (053).
 */
export function deduceByLigaTreatment(
  ours: readonly LigaArt[],
  theirs: readonly SourceProductOption[],
): LigaPair[] {
  const itens = ours
    .filter((art) => art.ligaUrl)
    .map((art) => ({ art, ...ligaIdentity(art) }))
    .filter((item) => item.chave !== null)

  const quantasNossas = new Map<string, number>()
  for (const { chave } of itens) quantasNossas.set(chave!, (quantasNossas.get(chave!) ?? 0) + 1)

  const pares: LigaPair[] = []
  for (const { art, tratamento, edicao, chave } of itens) {
    if (quantasNossas.get(chave!) !== 1) continue

    let produtos =
      tratamento === null
        ? theirs.filter((produto) => sourceTreatmentKey(produto.label) === '' && editionMatchesGroup(edicao, produto.groupCode))
        : theirs.filter((produto) => sourceTreatmentKey(produto.label) === tratamento)

    // Mesmo nome em mais de um produto: fica o do grupo da edicao, se so ele.
    if (produtos.length > 1 && tratamento !== null) {
      produtos = produtos.filter((produto) => editionMatchesGroup(edicao, produto.groupCode))
    }
    if (produtos.length !== 1) continue
    pares.push({ variantId: art.variantId, productId: produtos[0].productId })
  }

  // Um produto nao pode ter dois donos: se duas artes chegaram nele, nenhuma leva.
  const vezes = new Map<string, number>()
  for (const par of pares) vezes.set(par.productId, (vezes.get(par.productId) ?? 0) + 1)
  return pares.filter((par) => vezes.get(par.productId) === 1)
}
