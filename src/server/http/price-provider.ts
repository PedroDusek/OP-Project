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

/**
 * Um produto que é **outra arte** da carta, e não a comum.
 *
 * Vem sem casar com nada: qual arte nossa ele é, o nosso catálogo não sabe
 * dizer sozinho (decisão 023), e é isso que o vínculo da decisão 053 resolve.
 *
 * `value` pode ser nulo — a fonte lista produtos que não tem à venda. Ele vem
 * junto mesmo assim, porque a lista de artes é o que permite vincular, e
 * vincular hoje serve mesmo que o preço só apareça amanhã.
 */
export interface SourceArtProduct {
  cardCode: string
  /** O id do produto na fonte, como texto. */
  productId: string
  /** O tratamento, como a fonte escreve: `Alternate Art`, `SP + Gold`. */
  label: string
  value: number | null
}

/**
 * O que uma passada pela fonte devolve.
 *
 * Uma passada, e não duas: são 87 arquivos, e tanto o preço da arte comum
 * quanto a lista de artes para vincular saem dos mesmos. Buscar em separado
 * dobraria a carga sobre infraestrutura de terceiro para ler o mesmo dado.
 *
 * A data vem junto porque ela é uma afirmação diferente da nossa: `sourceUpdatedAt`
 * diz de quando é o dado do mercado, e o horário da nossa importação diz quando
 * conferimos. Confundir os dois é o que faz uma tela dizer "atualizado agora"
 * sobre um número de ontem.
 */
/**
 * A arte comum de uma carta, identificada na fonte.
 *
 * Separada dos preços porque nem toda arte comum tem cotação — e a que não tem
 * continua servindo para uma coisa: **a imagem**. O produto da fonte é a única
 * referência de imagem que autoriza leitura cruzada, e é dela que sai a folha
 * em JPEG (decisão 058).
 */
export interface SourceCommonArt {
  cardCode: string
  /** O id do produto na fonte, como texto. */
  productId: string
}

export interface PriceSnapshot {
  /** Preços da arte comum, já casados por código. */
  prices: SourcePrice[]
  /** Toda arte comum identificada, com ou sem preço. */
  commonArts: SourceCommonArt[]
  /** As demais artes, com ou sem preço, para vincular. */
  arts: SourceArtProduct[]
  /** Quando a fonte publicou este conjunto. Nulo quando ela não informa. */
  sourceUpdatedAt: Date | null
}

export interface PriceProvider {
  readonly name: string
  /** Uma passada pela fonte: preços da arte comum e a lista das demais artes. */
  fetchSnapshot(knownNames: KnownCardNames): Promise<PriceSnapshot>
}
