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
 * de sexta, e isso é normal.
 *
 * ## Por que sete, e não três (21/09)
 *
 * Três dias pareciam cobrir o fim de semana com um feriado emendado, e não
 * cobriam. A tarefa de preços roda às 04:00 de Brasília, e **a PTAX do dia só
 * sai no meio da tarde** — então na segunda de manhã ela ainda encontra a
 * cotação de sexta. A conta chegava a quatro dias à meia-noite UTC, que são
 * 21:00 de Brasília, e o real sumia da tela **toda segunda à noite**, no
 * horário de maior uso, até a tarefa da terça consertar sozinha.
 *
 * O dono do produto escolheu alargar a janela para uma semana em vez de mexer
 * no horário da tarefa. Sete dias absorvem esse atraso estrutural e qualquer
 * feriado prolongado.
 *
 * ## O que se perde, e o que segura
 *
 * Com uma semana de tolerância, uma importação que pare de rodar demora até
 * sete dias para aparecer na tela. **O que segura isso é a tela dizer a data da
 * cotação** ao lado do valor (`market-price.tsx`): o número nunca se apresenta
 * como sendo de hoje se não for. Quem olhar vê "5,11 em 21/09" e tira a própria
 * conclusão.
 *
 * Passando de sete dias o real some, e aí é sinal de que a importação parou —
 * não de calendário.
 */
export const MAX_RATE_AGE_IN_DAYS = 7

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
