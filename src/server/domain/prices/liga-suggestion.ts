import {
  editionMatchesGroup,
  ligaIdentity,
  sourceTreatmentKey,
  type LigaArt,
} from '@/server/domain/prices/liga-treatment'

/**
 * O produto que a página da Liga aponta para uma arte, quando é outro que não o
 * vinculado — para a tela `/dev/paralelas` perguntar (decisão 077).
 *
 * Camada: domain. Puro.
 *
 * ## Por que existe
 *
 * O arquivo manual vence qualquer regra, e por isso um engano nele não é
 * corrigido por ninguém. Medido em 16/09: a `OP01-052_p1`, cuja página na Liga é
 * a do Event Pack Vol. 2, estava no Jolly Roger Foil — e a `OP01-052_p3`, cuja
 * página é a do Jolly Roger Foil, ficou sem vínculo. A tela antiga não mostrava o
 * produto do Event Pack, e a escolha errada era a única possível.
 *
 * ## Só quando a sugestão é clara
 *
 * Um produto só, com o tratamento que a Liga dá. Com dois de mesmo nome, fica o do
 * grupo da edição; e quando a edição tem grupo na carta, o produto tem de ser dele
 * — a Manga da `OP03-122` na edição `OP-03` não é a Manga da PRB-01. Produto que
 * uma irmã segura com razão — a página dela diz o mesmo tratamento — não é
 * sugerido: seria tirar de quem está certo.
 *
 * Nomes que a Liga e o TCGplayer escrevem diferente (`Manga` × `Super Alternate
 * Art`) não geram sugestão nenhuma, e não enchem a tela do que já foi conferido.
 */

export interface SuggestionProduct {
  productId: string
  label: string
  groupCode: string | null
  /** O `source_id` da arte que segura o produto hoje, se alguma. */
  dono: string | null
}

export interface SuggestionArt extends Omit<LigaArt, 'variantId'> {
  sourceId: string
}

function casa(art: SuggestionArt, produto: SuggestionProduct): boolean {
  const { tratamento, edicao, chave } = ligaIdentity(art)
  if (chave === null) return false
  if (tratamento === null) {
    return sourceTreatmentKey(produto.label) === '' && editionMatchesGroup(edicao, produto.groupCode)
  }
  return sourceTreatmentKey(produto.label, art.cardName) === tratamento
}

export function ligaSuggestion(
  art: SuggestionArt,
  atual: string | null,
  produtos: readonly SuggestionProduct[],
  irmas: readonly SuggestionArt[],
): string | null {
  const { tratamento, edicao, chave } = ligaIdentity(art)
  if (chave === null) return null

  let candidatos = produtos.filter((produto) => casa(art, produto))
  const edicaoTemGrupo = produtos.some((produto) => editionMatchesGroup(edicao, produto.groupCode))
  if (tratamento !== null && (candidatos.length > 1 || edicaoTemGrupo)) {
    candidatos = candidatos.filter((produto) => editionMatchesGroup(edicao, produto.groupCode))
  }
  if (candidatos.length !== 1) return null

  const [sugerido] = candidatos
  if (sugerido.productId === atual) return null
  if (sugerido.dono !== null && sugerido.dono !== art.sourceId) {
    const dona = irmas.find((irma) => irma.sourceId === sugerido.dono)
    // Da normal, ou de uma irma cuja pagina diz o mesmo: o dono esta certo.
    if (!dona || casa(dona, sugerido)) return null
  }
  return sugerido.productId
}
