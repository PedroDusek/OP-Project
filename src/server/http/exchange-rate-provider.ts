/**
 * Contrato da fonte de câmbio.
 *
 * Camada: http. Sem I/O: apenas o formato do que uma fonte devolve.
 *
 * Existe pelo mesmo motivo do provedor de preço (decisão 025): o caso de uso
 * não sabe de onde a cotação vem, e o teste roda com uma fonte falsa, sem rede.
 *
 * A **data da cotação** faz parte do contrato, e não é detalhe: a fonte oficial
 * só publica em dia útil, então a cotação mais recente numa segunda é a de
 * sexta. Uma fonte que devolvesse só o número obrigaria quem chama a supor que
 * ele é de hoje — e a tela precisa dizer de quando ele é.
 */

export interface SourceRate {
  base: 'USD'
  quote: 'BRL'
  /** Quantos reais vale uma unidade da moeda base. */
  rate: number
  /** O dia a que a cotação se refere, e não o dia em que foi buscada. */
  quoteDate: Date
}

export interface ExchangeRateProvider {
  readonly name: string
  /**
   * A cotação mais recente até `on`, inclusive.
   *
   * `null` quando a fonte não tem nada no alcance procurado — o que é falha, e
   * não ausência normal: um dia útil sem PTAX significa fonte fora do ar.
   */
  fetchLatestUsdBrl(on: Date): Promise<SourceRate | null>
}
