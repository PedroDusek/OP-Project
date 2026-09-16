/**
 * O preço de mercado de um produto a partir das cotações por acabamento.
 *
 * Camada: domain. Puro.
 *
 * O TCGplayer cota o mesmo produto por acabamento — `Normal` e `Foil` —, e o
 * nosso catálogo guarda uma variante só. A decisão 050 não dava preço quando
 * havia os dois; a 078, do dono do produto, fica com o `Normal`: a impressão
 * comum da carta.
 *
 * Com dois acabamentos e nenhum deles `Normal`, não há como escolher sem
 * inventar, e fica sem preço. Não acontece hoje: medido em 16/09, os 90 produtos
 * com duas cotações são todos `Normal` + `Foil`.
 */
export function marketPriceOf(cotacoes: readonly { subType: string | null; value: number }[]): number | null {
  if (cotacoes.length === 0) return null
  if (cotacoes.length === 1) return cotacoes[0].value
  const normais = cotacoes.filter((cotacao) => cotacao.subType === 'Normal')
  return normais.length === 1 ? normais[0].value : null
}
