/**
 * Converter o preço para real.
 *
 * Camada: domain. Puro: recebe valor e taxa, devolve valor.
 *
 * ## O valor em real não é guardado
 *
 * O que fica no banco é o preço em dólar e a cotação do dia, separados. O real
 * é derivado na leitura.
 *
 * Guardar o convertido criaria duas verdades para o mesmo fato: se a cotação de
 * um dia fosse corrigida — e o Banco Central corrige —, o valor gravado
 * continuaria contando a história antiga, e ninguém saberia qual dos dois
 * números estava certo. Derivar custa uma multiplicação e não pode divergir.
 *
 * Também é o que a regra 5.1 exige: o valor histórico de um trade sai do preço
 * vigente em `completed_at`. Em real, isso é o preço daquele dia vezes a cotação
 * daquele dia — duas linhas com data, não um número congelado.
 *
 * ## O arredondamento acontece uma vez, no fim
 *
 * `12,34 USD × 5,1253` dá 63,245... Arredondar a taxa antes, ou arredondar em
 * duas etapas, faria a soma de uma coleção divergir da soma dos itens dela.
 * Aqui a conta é feita inteira e arredondada uma vez só, em centavos.
 */

/** Meio centavo para cima, como qualquer conta de dinheiro em real. */
export function convertToBrl(valueInUsd: number, rate: number): number {
  return Math.round(valueInUsd * rate * 100) / 100
}

/**
 * A cotação está velha demais para ser chamada de "do dia"?
 *
 * O PTAX só existe em dia útil: numa segunda-feira, a cotação mais recente é a
 * de sexta, e isso é normal. Três dias cobrem o fim de semana com um feriado
 * emendado — que é o buraco mais longo que o calendário brasileiro produz sem
 * que algo esteja errado.
 *
 * Passando disso, a importação parou de rodar, e o número na tela deixa de ser
 * uma conversão para virar um palpite com cara de dado.
 */
export const MAX_RATE_AGE_IN_DAYS = 3

export function isRateStale(quoteDate: Date, today: Date): boolean {
  return daysBetween(quoteDate, today) > MAX_RATE_AGE_IN_DAYS
}

/**
 * Dias entre duas datas, contando só o calendário.
 *
 * Compara à meia-noite UTC dos dois lados: `quote_date` é `DATE` no banco e
 * chega sem hora, então comparar instantes faria o resultado depender do fuso
 * de quem pergunta.
 */
function daysBetween(from: Date, to: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  return Math.round((end - start) / MS_PER_DAY)
}
