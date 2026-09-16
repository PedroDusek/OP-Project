import { editionMatchesGroup } from '@/server/domain/prices/liga-treatment'

/**
 * Qual arte comum da fonte é a normal do nosso catálogo, quando o número saiu em
 * mais de um grupo.
 *
 * Camada: domain. Puro. Fora de `matching.ts` porque lê a edição como a regra da
 * Liga (`editionMatchesGroup`), e `liga-treatment` já depende de `matching`.
 */

/** A arte comum de um número num grupo da fonte, com o preço de mercado dela. */
export interface CommonCandidate {
  productId: string
  groupCode: string | null
  /** `undefined` quando o produto não tem cotação única. */
  value: number | undefined
}

/**
 * O produto que dá a imagem e o preço da normal, entre as artes comuns do número
 * em cada grupo, na ordem da fonte (decisão 076).
 *
 * O grupo da coleção do código vence: a Zoro `OP01-001` é a do `OP01`, a US$ 2,15,
 * e não a reimpressão do `OP-DD`, a US$ 8,30. Medido em 16/09, a regra antiga — o
 * primeiro grupo, que na fonte é o lançamento mais novo — dava à normal da
 * `OP13-037` o preço da TR da `OP15-EB04`, US$ 202. Com o grupo da coleção, o
 * preço é o dele, mesmo sem cotação: buscar o de outro grupo traria a reimpressão
 * de volta.
 *
 * Sem o grupo da coleção — as promos `P-`, que não nomeiam coleção —, vale a
 * regra antiga: a imagem do primeiro grupo, e o preço do primeiro que tem.
 */
export function normalProduct(
  cardCode: string,
  candidatas: readonly CommonCandidate[],
): { productId: string; value: number | null } {
  const colecao = cardCode.trim().toUpperCase().split('-')[0]
  const daColecao = candidatas.find((c) => editionMatchesGroup(colecao, c.groupCode))
  if (daColecao) return { productId: daColecao.productId, value: daColecao.value ?? null }

  const comPreco = candidatas.find((c) => c.value !== undefined)
  return { productId: candidatas[0].productId, value: comPreco?.value ?? null }
}
