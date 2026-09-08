/**
 * Contrato da fonte de preço.
 *
 * Camada: http. Sem I/O: apenas o formato do que uma fonte devolve.
 *
 * Existe pelo mesmo motivo dos outros provedores (decisão 025): o caso de uso
 * não sabe de onde o preço vem. Trocar de fonte mexe numa implementação, e os
 * testes rodam com uma fonte falsa, sem rede.
 *
 * A moeda faz parte do contrato, e não é suposição: a fonte de hoje cota em
 * dólar, e uma tela que mostrar valor precisa dizer isso.
 */

export interface SourcePrice {
  /** O código da carta, como a fonte informa: `OP01-002`. */
  cardCode: string
  /** Preço de mercado, na moeda da fonte. */
  value: number
  currency: 'USD'
}

/**
 * O nome que o nosso catálogo dá a cada carta, por código em maiúsculas.
 *
 * A fonte precisa disto para desempatar cartas cujo nome tem parênteses de
 * verdade — `Mr.1(Daz.Bonez)` — e que sem o desempate ficariam sem preço. Quem
 * chama é dono do catálogo; a fonte só compara.
 */
export type KnownCardNames = ReadonlyMap<string, string>

export interface PriceProvider {
  readonly name: string
  /** Todos os preços de arte comum que a fonte consegue identificar. */
  fetchCommonArtPrices(knownNames: KnownCardNames): Promise<SourcePrice[]>
}
