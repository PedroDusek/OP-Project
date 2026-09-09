import type { PrismaClient } from '@prisma/client'
import { convertToBrl, isRateStale } from '@/server/domain/prices/currency'

/**
 * Leitura de preço.
 *
 * Camada: application.
 *
 * O preço vigente e a **ultima linha** da serie — precos nunca sao sobrescritos
 * (`business-rules.md` 5), entao "o preco de hoje" e a captura mais recente.
 *
 * ## Tres datas diferentes, e a tela precisa das tres
 *
 * E aqui que o modelo esparso cobra atencao. Sao coisas distintas:
 *
 * - **`since`**: quando este valor passou a valer. Vem de `card_prices`, e e a
 *   data da ultima **mudanca** — pode ser de semanas atras num common estavel.
 * - **`checkedAt`**: quando conferimos pela ultima vez. Vem de `price_imports`,
 *   e e o que a tela mostra como "atualizado hoje as 04:00".
 * - **`sourceUpdatedAt`**: de quando e o dado do mercado. O espelho publica as
 *   20:00 UTC, entao a conferida das 04:00 le o fim da tarde anterior.
 *
 * Dizer "atualizado em" usando `since` seria falso, e foi por isso que a
 * primeira versao dizia so "desde". Com o registro de importacao (decisao 051)
 * as duas afirmacoes existem, cada uma com a sua fonte.
 *
 * ## O real e derivado, nao guardado
 *
 * `brl` sai do preco em dolar vezes a cotacao do dia, calculado na leitura. O
 * porque esta em `domain/prices/currency.ts`: guardar o convertido criaria duas
 * verdades para o mesmo fato.
 *
 * Sem cotacao recente, `brl` e nulo e a tela mostra so o dolar. Converter por
 * uma taxa velha seria apresentar um palpite com cara de dado.
 */

export interface MarketPrice {
  value: number
  /** Quando este valor passou a valer. Nao e a data da ultima verificacao. */
  since: Date
  currency: 'USD'
  /** O mesmo valor em real, ou nulo quando nao ha cotacao utilizavel. */
  brl: BrlValue | null
}

export interface BrlValue {
  value: number
  /** A cotacao usada, para a tela poder mostra-la. */
  rate: number
  /** O dia da cotacao. Numa segunda, costuma ser a sexta. */
  rateDate: Date
}

/** Quando os precos foram conferidos pela ultima vez, e de quando e o dado. */
export interface PriceFreshness {
  checkedAt: Date
  sourceUpdatedAt: Date | null
}

export async function getMarketPrice(
  prisma: PrismaClient,
  cardVariantId: bigint,
  now: Date = new Date(),
): Promise<MarketPrice | null> {
  const price = await prisma.cardPrice.findFirst({
    where: { cardVariantId },
    orderBy: { capturedAt: 'desc' },
    select: { value: true, capturedAt: true },
  })
  if (!price) return null

  const value = Number(price.value)
  const rate = await getUsdBrlRate(prisma, now)

  return {
    value,
    since: price.capturedAt,
    currency: 'USD',
    brl: rate
      ? { value: convertToBrl(value, rate.rate), rate: rate.rate, rateDate: rate.quoteDate }
      : null,
  }
}

/**
 * A cotacao mais recente que ainda vale.
 *
 * Nula quando nao ha nenhuma, ou quando a que existe esta velha demais — o
 * criterio esta no dominio, junto da explicacao de por que tres dias.
 */
export async function getUsdBrlRate(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<{ rate: number; quoteDate: Date } | null> {
  const row = await prisma.exchangeRate.findFirst({
    where: { baseCurrency: 'USD', quoteCurrency: 'BRL' },
    orderBy: { quoteDate: 'desc' },
    select: { rate: true, quoteDate: true },
  })
  if (!row) return null
  if (isRateStale(row.quoteDate, now)) return null

  return { rate: Number(row.rate), quoteDate: row.quoteDate }
}

/**
 * A ultima importacao que terminou sem falha.
 *
 * Uma que terminou com `failure` nao conferiu nada: contar ela faria a tela
 * dizer "atualizado hoje" justamente no dia em que a importacao quebrou, que e
 * quando o aviso mais precisa ser verdade.
 */
export async function getPriceFreshness(prisma: PrismaClient): Promise<PriceFreshness | null> {
  const run = await prisma.priceImport.findFirst({
    where: { finishedAt: { not: null }, failure: null },
    orderBy: { finishedAt: 'desc' },
    select: { finishedAt: true, sourceUpdatedAt: true },
  })
  if (!run?.finishedAt) return null

  return { checkedAt: run.finishedAt, sourceUpdatedAt: run.sourceUpdatedAt }
}
