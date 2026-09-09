import type { PrismaClient } from '@prisma/client'
import type { ExchangeRateProvider } from '@/server/http/exchange-rate-provider'

/**
 * Importar a cotação do dólar.
 *
 * Camada: application.
 *
 * Roda junto da importação de preços, e é uma requisição só — o custo ao lado
 * dos 87 arquivos do catálogo de preços é irrelevante, e manter os dois no
 * mesmo horário faz a tela mostrar preço e câmbio do mesmo momento.
 *
 * ## Uma linha por dia, atualizada e não duplicada
 *
 * Rodar duas vezes no mesmo dia grava a mesma data: o `upsert` mantém uma linha
 * por par por dia. Sem isso, "a cotação de hoje" dependeria de qual das linhas a
 * consulta escolhesse — e no fim de semana, quando a data da cotação é a de
 * sexta, seriam três dias inteiros gravando repetido.
 *
 * O valor é sobrescrito de propósito, ao contrário de `card_prices`: o Banco
 * Central corrige cotação publicada, e duas verdades para o mesmo dia é
 * exatamente o que a chave única existe para impedir.
 */

export interface ImportExchangeRateResult {
  rate: number
  quoteDate: Date
  /** A cotação já estava gravada com este mesmo valor. */
  unchanged: boolean
}

export interface ImportExchangeRateOptions {
  logger?: Pick<Console, 'info' | 'warn'>
  /** O dia a consultar. Injetável para o teste não depender do relógio. */
  on?: Date
}

export async function importExchangeRate(
  prisma: PrismaClient,
  provider: ExchangeRateProvider,
  options: ImportExchangeRateOptions = {},
): Promise<ImportExchangeRateResult | null> {
  const logger = options.logger ?? console
  const on = options.on ?? new Date()

  const quote = await provider.fetchLatestUsdBrl(on)
  if (!quote) {
    logger.warn(`[cambio] fonte ${provider.name} nao devolveu cotacao`)
    return null
  }

  const existing = await prisma.exchangeRate.findUnique({
    where: {
      baseCurrency_quoteCurrency_quoteDate: {
        baseCurrency: quote.base,
        quoteCurrency: quote.quote,
        quoteDate: quote.quoteDate,
      },
    },
    select: { rate: true },
  })

  const unchanged = existing !== null && sameRate(Number(existing.rate), quote.rate)

  if (!unchanged) {
    await prisma.exchangeRate.upsert({
      where: {
        baseCurrency_quoteCurrency_quoteDate: {
          baseCurrency: quote.base,
          quoteCurrency: quote.quote,
          quoteDate: quote.quoteDate,
        },
      },
      create: {
        baseCurrency: quote.base,
        quoteCurrency: quote.quote,
        quoteDate: quote.quoteDate,
        rate: quote.rate,
        source: provider.name,
      },
      update: { rate: quote.rate, source: provider.name, capturedAt: new Date() },
    })
  }

  logger.info(
    `[cambio] USD/BRL ${quote.rate} em ${quote.quoteDate.toISOString().slice(0, 10)}` +
      (unchanged ? ' (sem mudanca)' : ''),
  )

  return { rate: quote.rate, quoteDate: quote.quoteDate, unchanged }
}

/**
 * Compara na precisão da coluna.
 *
 * `numeric(18,6)` volta como texto e vira número: comparar com `===` faria a
 * cotação diferir de si mesma depois da ida e volta, e cada execução gravaria
 * de novo.
 */
function sameRate(a: number, b: number): boolean {
  return Math.round(a * 1e6) === Math.round(b * 1e6)
}
