import type { PrismaClient } from '@prisma/client'
import type { PriceProvider, SourcePrice } from '@/server/http/price-provider'

/**
 * Importar preços de arte comum.
 *
 * Camada: application.
 *
 * ## Só arte comum, por enquanto
 *
 * O código da carta identifica a carta, não a arte: uma carta tem a comum, a
 * paralela, a alternativa, o box topper. A fonte distingue pelo nome do produto,
 * e o nosso catálogo só separa Normal de Parallel (decisão 023) — não há como
 * dizer qual paralela é qual.
 *
 * Então entra preço só na variante **Normal**, que é identificável sem
 * ambiguidade e é a que a maioria das pessoas tem. Paralela fica sem preço, e a
 * tela diz isso — mostrar o preço da comum como se fosse o da paralela seria
 * inventar um número num campo de dinheiro.
 *
 * ## Grava só o que mudou
 *
 * `card_prices` é histórico: preços nunca são sobrescritos (`business-rules.md`
 * 5). Gravar toda captura diária de todas as variantes daria 1,77 milhão de
 * linhas por ano; gravar só quando o valor muda derruba isso para uma fração —
 * um *common* fica meses no mesmo preço.
 *
 * A série fica esparsa, e é o que o modelo já suporta: "preço vigente em T" é a
 * última linha com `captured_at <= T`, e o índice único
 * `(card_variant_id, captured_at)` atende essa leitura por ser percorrido ao
 * contrário.
 *
 * **O que isso custa em precisão**: sem linha nova, não dá para distinguir
 * "não mudou" de "não foi verificado".
 *
 * Quem paga essa conta é `price_imports`: cada execução deixa um registro com o
 * horário, o carimbo da fonte e o que aconteceu. É de lá que a tela tira
 * "atualizado hoje às 04:00" — a série de preços continua esparsa, e a
 * afirmação sobre a conferência tem onde morar (decisão 051).
 */

export interface ImportPricesResult {
  /** Preços que a fonte entregou. */
  fetched: number
  /** Casados com uma variante Normal do nosso catálogo. */
  matched: number
  /** Gravados, por serem diferentes do último valor conhecido. */
  written: number
  /** Iguais ao último valor: nada a fazer. */
  unchanged: number
  /** Códigos que a fonte trouxe e o nosso catálogo não conhece. */
  unknownCodes: number
  /** Quando a fonte publicou os dados desta passada. Nulo se ela não informa. */
  sourceUpdatedAt: Date | null
}

export interface ImportPricesOptions {
  logger?: Pick<Console, 'info' | 'warn'>
  /** O instante da captura. Injetável para o teste não depender do relógio. */
  capturedAt?: Date
}

export async function importPrices(
  prisma: PrismaClient,
  provider: PriceProvider,
  options: ImportPricesOptions = {},
): Promise<ImportPricesResult> {
  const logger = options.logger ?? console
  const capturedAt = options.capturedAt ?? new Date()

  const run = await prisma.priceImport.create({
    data: { source: provider.name, startedAt: capturedAt },
    select: { id: true },
  })

  try {
    const result = await runImport(prisma, provider, capturedAt, logger)

    await prisma.priceImport.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        sourceUpdatedAt: result.sourceUpdatedAt,
        fetched: result.fetched,
        matched: result.matched,
        written: result.written,
        unchanged: result.unchanged,
        unknownCodes: result.unknownCodes,
      },
    })

    logger.info(
      `[precos] casados ${result.matched}, gravados ${result.written}, ` +
        `sem mudanca ${result.unchanged}, codigo desconhecido ${result.unknownCodes}`,
    )

    return result
  } catch (error) {
    /*
     * A falha fica gravada e a excecao sobe. Sem o registro, uma importacao que
     * parou de rodar vira preco velho na tela sem nenhum aviso — que e
     * exatamente o modo de falha que este registro existe para tornar visivel.
     */
    await prisma.priceImport.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), failure: describe(error) },
    })
    throw error
  }
}

/** Erro em texto curto, para caber na coluna sem virar despejo de stack. */
function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, 500)
}

/**
 * A importação em si, sem o registro em volta.
 *
 * Separada para que o `try` acima seja curto e óbvio: tudo que acontecer aqui
 * dentro deixa rastro em `price_imports`, dando certo ou não.
 */
async function runImport(
  prisma: PrismaClient,
  provider: PriceProvider,
  capturedAt: Date,
  logger: Pick<Console, 'info' | 'warn'>,
): Promise<ImportPricesResult> {
  const knownNames = await knownCardNames(prisma)
  const { prices, sourceUpdatedAt } = await provider.fetchCommonArtPrices(knownNames)
  logger.info(`[precos] fonte ${provider.name}: ${prices.length} precos de arte comum`)

  const variants = await commonArtVariants(prisma, prices)
  const latest = await latestValues(prisma, [...variants.values()])

  let matched = 0
  let written = 0
  let unchanged = 0
  let unknownCodes = 0

  for (const price of prices) {
    const variantId = variants.get(price.cardCode.toUpperCase())
    if (variantId === undefined) {
      unknownCodes++
      continue
    }
    matched++

    const previous = latest.get(String(variantId))
    if (previous !== undefined && sameValue(previous, price.value)) {
      unchanged++
      continue
    }

    await prisma.cardPrice.create({
      data: { cardVariantId: variantId, value: price.value, capturedAt },
    })
    written++
  }

  return {
    fetched: prices.length,
    matched,
    written,
    unchanged,
    unknownCodes,
    sourceUpdatedAt,
  }
}

/**
 * O nome de cada carta do nosso catálogo, por código em maiúsculas.
 *
 * A fonte usa isto para desempatar cartas cujo nome tem parênteses de verdade
 * — `Mr.1(Daz.Bonez)`. São 2.785 linhas de duas colunas: cabe na memória, e
 * mandar o catálogo inteiro evita ter de adivinhar antes quais vão precisar.
 */
async function knownCardNames(prisma: PrismaClient): Promise<Map<string, string>> {
  const cards = await prisma.card.findMany({ select: { code: true, name: true } })
  return new Map(cards.map((card) => [card.code.toUpperCase(), card.name]))
}

/**
 * A variante Normal de cada código que a fonte trouxe.
 *
 * Uma consulta só, e não uma por preço: são milhares de códigos, e o N+1 aqui
 * transformaria a importação numa tarde.
 *
 * Códigos com mais de uma variante Normal ficam de fora — não deveria
 * acontecer, e se acontecer é ambiguidade, que não vira palpite.
 */
async function commonArtVariants(
  prisma: PrismaClient,
  prices: readonly SourcePrice[],
): Promise<Map<string, bigint>> {
  const codes = [...new Set(prices.map((price) => price.cardCode.toUpperCase()))]
  if (codes.length === 0) return new Map()

  const rows = await prisma.cardVariant.findMany({
    where: { variantType: 'Normal', card: { code: { in: codes } } },
    select: { id: true, card: { select: { code: true } } },
  })

  const byCode = new Map<string, bigint[]>()
  for (const row of rows) {
    const code = row.card.code.toUpperCase()
    const list = byCode.get(code)
    if (list) list.push(row.id)
    else byCode.set(code, [row.id])
  }

  const chosen = new Map<string, bigint>()
  for (const [code, ids] of byCode) {
    if (ids.length === 1) chosen.set(code, ids[0])
  }

  return chosen
}

/**
 * O último valor conhecido de cada variante.
 *
 * `DISTINCT ON` com a ordem descendente lê o índice único ao contrário e devolve
 * uma linha por variante — a alternativa seria uma consulta por carta.
 */
async function latestValues(
  prisma: PrismaClient,
  variantIds: readonly bigint[],
): Promise<Map<string, number>> {
  if (variantIds.length === 0) return new Map()

  const rows = await prisma.$queryRawUnsafe<{ card_variant_id: bigint; value: string }[]>(
    `SELECT DISTINCT ON (card_variant_id) card_variant_id, value::text
     FROM card_prices
     WHERE card_variant_id IN (${variantIds.join(',')})
     ORDER BY card_variant_id, captured_at DESC`,
  )

  return new Map(rows.map((row) => [String(row.card_variant_id), Number(row.value)]))
}

/**
 * Compara em centavos.
 *
 * A coluna é `numeric(12,2)` e o valor chega como número de ponto flutuante:
 * comparar direto faria 12.34 diferir de si mesmo depois da ida e volta, e cada
 * importação gravaria tudo de novo.
 */
function sameValue(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100)
}
