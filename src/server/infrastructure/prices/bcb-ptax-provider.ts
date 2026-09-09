import type { ExchangeRateProvider, SourceRate } from '@/server/http/exchange-rate-provider'

/**
 * Cotação do dólar pelo PTAX do Banco Central (decisão 051).
 *
 * Camada: infrastructure.
 *
 * ## Por que o Banco Central
 *
 * É a referência oficial brasileira, aberta, sem chave e sem cadastro. Qualquer
 * pessoa consegue conferir o número que a tela mostra no site do BC — o que não
 * é pouco num campo de dinheiro.
 *
 * A alternativa considerada era uma API comercial gratuita de cotação ao vivo.
 * Ela cobre fim de semana, mas é serviço de terceiro sem compromisso de
 * disponibilidade: no dia em que sumisse, o valor em real sumiria da tela.
 *
 * ## Dia útil, e o que isso obriga
 *
 * O PTAX não existe em sábado, domingo nem feriado bancário. A consulta de uma
 * data sem cotação devolve **lista vazia** — não erro —, então quem chama
 * precisa andar para trás até achar. Cinco dias cobrem um fim de semana com
 * feriado emendado dos dois lados, que é o buraco mais longo que o calendário
 * produz normalmente.
 *
 * Andar para trás um dia por vez custa até cinco requisições numa segunda-feira
 * de feriado, contra uma numa terça comum. O endpoint de período resolveria em
 * uma só, mas exige montar duas datas e ordenar o resultado; com no máximo
 * cinco chamadas por dia, a simplicidade vale mais que a economia.
 *
 * ## `cotacaoVenda`, e não a de compra
 *
 * São dois números por dia: o que se paga para comprar dólar e o que se recebe
 * para vender. Quem olha o preço de uma carta americana está pensando em
 * *comprar* dólar, então a venda é a taxa que responde à pergunta. A diferença
 * é pequena — 5,12470 contra 5,12530 em 04/09 — mas escolher sem dizer qual
 * seria escolher no escuro.
 */

const BASE = 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata'

/** Dias para trás até desistir. Cobre fim de semana com feriado emendado. */
const MAX_LOOKBACK_DAYS = 5

interface PtaxQuote {
  cotacaoCompra: number
  cotacaoVenda: number
  dataHoraCotacao: string
}

export interface BcbPtaxOptions {
  fetchImpl?: typeof fetch
  logger?: Pick<Console, 'info' | 'warn'>
}

export class BcbPtaxProvider implements ExchangeRateProvider {
  readonly name = 'bcb-ptax'

  private readonly fetchImpl: typeof fetch
  private readonly logger: Pick<Console, 'info' | 'warn'>

  constructor(options: BcbPtaxOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.logger = options.logger ?? console
  }

  async fetchLatestUsdBrl(on: Date): Promise<SourceRate | null> {
    for (let back = 0; back <= MAX_LOOKBACK_DAYS; back++) {
      const day = addDays(on, -back)
      const quote = await this.quoteFor(day)

      if (quote) {
        if (back > 0) {
          this.logger.info(
            `[cambio] sem PTAX em ${isoDate(on)}; usando ${isoDate(day)}`,
          )
        }
        return { base: 'USD', quote: 'BRL', rate: quote.cotacaoVenda, quoteDate: day }
      }
    }

    this.logger.warn(
      `[cambio] nenhuma cotacao nos ${MAX_LOOKBACK_DAYS} dias anteriores a ${isoDate(on)}`,
    )
    return null
  }

  private async quoteFor(day: Date): Promise<PtaxQuote | null> {
    const url =
      `${BASE}/CotacaoDolarDia(dataCotacao=@dataCotacao)` +
      `?@dataCotacao='${usDate(day)}'&$format=json&$top=1`

    const response = await this.fetchImpl(url, { headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`Falha ao ler ${url}: ${response.status}`)

    const body = (await response.json()) as { value?: PtaxQuote[] }
    const quote = body.value?.[0]

    // Dia sem cotacao devolve lista vazia, e nao erro: e assim que o servico
    // diz "sabado". Cotacao zerada seria dado quebrado, e nao vale como achado.
    if (!quote || !(quote.cotacaoVenda > 0)) return null
    return quote
  }
}

/** O serviço espera `MM-DD-YYYY`, entre aspas simples, no formato americano. */
function usDate(day: Date): string {
  const mm = String(day.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(day.getUTCDate()).padStart(2, '0')
  return `${mm}-${dd}-${day.getUTCFullYear()}`
}

function isoDate(day: Date): string {
  return day.toISOString().slice(0, 10)
}

/**
 * Soma dias em UTC.
 *
 * Em UTC e não no fuso local porque a data da cotação é um dia de calendário,
 * não um instante: somar no horário local faria a virada do dia depender de
 * onde o servidor está.
 */
function addDays(from: Date, days: number): Date {
  return new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + days),
  )
}
