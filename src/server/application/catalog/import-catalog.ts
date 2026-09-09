import type { Prisma, PrismaClient } from '@prisma/client'
import { PROMO_SET } from '@/server/domain/catalog/types'
import type {
  CardDTO,
  CatalogPage,
  CatalogProvider,
  ReprintDTO,
} from '@/server/domain/catalog/types'

/**
 * Importacao do catalogo.
 *
 * Camada: application. Dona da transacao e da idempotencia.
 *
 * Rodar duas vezes nao pode duplicar nada. As chaves de correspondencia sao:
 *
 *   sets              code
 *   vocabulario       name
 *   cards             code
 *   card_variants     (source, source_id)   <- decisao 019
 *   variant_printings (card_variant_id, set_id)
 *
 * Cada serie e uma transacao. Se qualquer registro dela falhar, a serie inteira
 * volta atras e as demais seguem, o que evita deixar o catalogo pela metade.
 */

export interface ImportReport {
  provider: string
  startedAt: Date
  finishedAt: Date
  seriesProcessed: number
  seriesFailed: number
  setsUpserted: number
  cardsUpserted: number
  variantsUpserted: number
  printingsUpserted: number
  rejected: { sourceId: string | null; reason: string }[]
  failures: { seriesId: string; reason: string }[]
  /**
   * Nomes dos produtos promocionais agrupados no set PROMO (decisao 024). O
   * agrupamento perde de qual evento veio cada carta, entao a lista fica aqui
   * para que o que foi colapsado seja visivel.
   */
  promotionalProductNames: string[]
  /** Variantes que a fonte trouxe sem campo de sets. */
  variantsWithoutSet: string[]
  /** Impressoes gravadas a partir de reimpressoes (decisao 052). */
  reprintPrintings: number
  /**
   * sourceIds de reimpressoes cuja arte reimpressa nao foi encontrada.
   *
   * Nao deveria acontecer: a fonte publica a arte comum antes de reimprimi-la.
   * Fica visivel em vez de sumir — se aparecer, ou a fonte mudou a notacao ou
   * uma serie falhou e levou junto uma carta que outra depende.
   */
  reprintsWithoutBase: string[]
}

export interface ImportOptions {
  /** Limita a quais series importar. Por padrao, todas as da fonte. */
  seriesIds?: string[]
  logger?: Pick<Console, 'info' | 'warn' | 'error'>
}

const TRANSACTION_TIMEOUT_MS = 120_000

export async function importCatalog(
  prisma: PrismaClient,
  provider: CatalogProvider,
  options: ImportOptions = {},
): Promise<ImportReport> {
  const log = options.logger ?? console
  const startedAt = new Date()

  const report: ImportReport = {
    provider: provider.name,
    startedAt,
    finishedAt: startedAt,
    seriesProcessed: 0,
    seriesFailed: 0,
    setsUpserted: 0,
    cardsUpserted: 0,
    variantsUpserted: 0,
    printingsUpserted: 0,
    rejected: [],
    failures: [],
    promotionalProductNames: [],
    variantsWithoutSet: [],
    reprintPrintings: 0,
    reprintsWithoutBase: [],
  }
  const promotional = new Set<string>()

  /*
   * As reimpressoes esperam o fim de tudo.
   *
   * `EB01-012_r1` chega na pagina do PRB-02, e a arte que ela reimprime esta
   * na do EB-01. Se as series vierem nessa ordem, gravar na hora perderia o
   * set; se vierem na outra, funcionaria. Depender da ordem em que a fonte
   * lista as series e o tipo de acerto que quebra sozinho um dia.
   */
  const reprints: ReprintDTO[] = []

  const seriesIds = options.seriesIds ?? (await provider.listSeriesIds())
  log.info(`[import] inicio provider=${provider.name} series=${seriesIds.length}`)

  for (const seriesId of seriesIds) {
    try {
      const page = await provider.fetchSeries(seriesId)
      const counts = await prisma.$transaction(
        (tx) => persistPage(tx, provider.name, page),
        { timeout: TRANSACTION_TIMEOUT_MS },
      )

      report.seriesProcessed += 1
      report.setsUpserted += counts.sets
      report.cardsUpserted += counts.cards
      report.variantsUpserted += counts.variants
      report.printingsUpserted += counts.printings
      report.rejected.push(...page.rejected)
      for (const name of page.promotionalProductNames) promotional.add(name)
      report.variantsWithoutSet.push(...page.variantsWithoutSet)
      reprints.push(...page.reprints)

      log.info(
        `[import] serie=${seriesId} sets=${counts.sets} cards=${counts.cards} ` +
          `variants=${counts.variants} printings=${counts.printings} ` +
          `rejeitados=${page.rejected.length}`,
      )
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      report.seriesFailed += 1
      report.failures.push({ seriesId, reason })
      log.error(`[import] serie=${seriesId} FALHOU: ${reason}`)
    }
  }

  if (reprints.length > 0) {
    const applied = await applyReprints(prisma, provider.name, reprints)
    report.reprintPrintings = applied.printings
    report.reprintsWithoutBase = applied.withoutBase
    log.info(
      `[import] ${reprints.length} reimpressoes: ${applied.printings} impressoes gravadas, ` +
        `${applied.withoutBase.length} sem arte correspondente`,
    )
  }

  report.promotionalProductNames = [...promotional].sort()
  report.finishedAt = new Date()

  if (report.promotionalProductNames.length > 0) {
    log.info(
      `[import] ${report.promotionalProductNames.length} produtos promocionais sem codigo ` +
        `agrupados no set ${PROMO_SET.code}.`,
    )
  }

  if (report.variantsWithoutSet.length > 0) {
    log.warn(
      `[import] ${report.variantsWithoutSet.length} variantes sem set: a fonte omitiu o campo. ` +
        report.variantsWithoutSet.slice(0, 5).join(', '),
    )
  }

  log.info(
    `[import] fim processadas=${report.seriesProcessed} falhas=${report.seriesFailed} ` +
      `cards=${report.cardsUpserted} variants=${report.variantsUpserted} ` +
      `rejeitados=${report.rejected.length} promocionais=${report.promotionalProductNames.length} ` +
      `sem_set=${report.variantsWithoutSet.length} ` +
      `duracao=${report.finishedAt.getTime() - report.startedAt.getTime()}ms`,
  )
  return report
}

interface PageCounts {
  sets: number
  cards: number
  variants: number
  printings: number
}

async function persistPage(
  tx: Prisma.TransactionClient,
  source: string,
  page: CatalogPage,
): Promise<PageCounts> {
  const setIdByCode = new Map<string, bigint>()
  for (const set of page.sets) {
    const row = await tx.set.upsert({
      where: { code: set.code },
      create: { code: set.code, name: set.name },
      update: { name: set.name },
    })
    setIdByCode.set(set.code, row.id)
  }

  const cardIdByCode = new Map<string, bigint>()
  for (const card of page.cards) {
    const row = await tx.card.upsert({
      where: { code: card.code },
      create: {
        code: card.code,
        name: card.name,
        type: card.type,
        cost: card.cost,
        power: card.power,
        life: card.life,
        counter: card.counter,
        hasTrigger: card.hasTrigger,
        blockIcon: card.blockIcon,
      },
      update: {
        // O codigo e imutavel e nunca aparece aqui.
        name: card.name,
        type: card.type,
        cost: card.cost,
        power: card.power,
        life: card.life,
        counter: card.counter,
        hasTrigger: card.hasTrigger,
        blockIcon: card.blockIcon,
      },
    })
    cardIdByCode.set(card.code, row.id)
    await syncVocabulary(tx, row.id, card)
  }

  let printings = 0
  for (const variant of page.variants) {
    const cardId = cardIdByCode.get(variant.cardCode)
    if (cardId === undefined) continue

    const row = await tx.cardVariant.upsert({
      where: { source_sourceId: { source, sourceId: variant.sourceId } },
      create: {
        cardId,
        variantType: variant.variantType,
        rarity: variant.rarity,
        imageUrl: variant.imageUrl,
        source,
        sourceId: variant.sourceId,
      },
      update: {
        cardId,
        variantType: variant.variantType,
        rarity: variant.rarity,
        imageUrl: variant.imageUrl,
      },
    })

    for (const setCode of variant.printedInSetCodes) {
      const setId = setIdByCode.get(setCode)
      if (setId === undefined) continue
      // A chave primaria composta e o que torna a reimpressao idempotente.
      await tx.variantPrinting.upsert({
        where: { cardVariantId_setId: { cardVariantId: row.id, setId } },
        create: { cardVariantId: row.id, setId },
        update: {},
      })
      printings += 1
    }
  }

  return {
    sets: page.sets.length,
    cards: page.cards.length,
    variants: page.variants.length,
    printings,
  }
}

/**
 * Grava as reimpressoes como impressoes da arte que elas reimprimem.
 *
 * Roda depois de todas as series, com o catalogo inteiro ja no banco: e a unica
 * hora em que se pode ter certeza de que a arte reimpressa existe, venha ela da
 * serie que veio.
 *
 * Uma transacao so para o lote. Sao poucas centenas de linhas, e ou o conjunto
 * inteiro entra ou nao entra nenhum — meia reimpressao gravada seria pior que
 * nenhuma, porque a proxima execucao acharia que ja estava tudo feito.
 */
async function applyReprints(
  prisma: PrismaClient,
  source: string,
  reprints: readonly ReprintDTO[],
): Promise<{ printings: number; withoutBase: string[] }> {
  const baseIds = [...new Set(reprints.map((r) => r.reprintOfSourceId))]
  const setCodes = [...new Set(reprints.flatMap((r) => r.printedInSetCodes))]

  const [bases, sets] = await Promise.all([
    prisma.cardVariant.findMany({
      where: { source, sourceId: { in: baseIds } },
      select: { id: true, sourceId: true },
    }),
    prisma.set.findMany({ where: { code: { in: setCodes } }, select: { id: true, code: true } }),
  ])

  const variantIdBySourceId = new Map(bases.map((b) => [b.sourceId ?? '', b.id]))
  const setIdByCode = new Map(sets.map((s) => [s.code, s.id]))

  const withoutBase: string[] = []
  const pares: { cardVariantId: bigint; setId: bigint }[] = []

  for (const reprint of reprints) {
    const cardVariantId = variantIdBySourceId.get(reprint.reprintOfSourceId)
    if (cardVariantId === undefined) {
      withoutBase.push(reprint.sourceId)
      continue
    }
    for (const code of reprint.printedInSetCodes) {
      const setId = setIdByCode.get(code)
      if (setId === undefined) continue
      pares.push({ cardVariantId, setId })
    }
  }

  if (pares.length === 0) return { printings: 0, withoutBase }

  const printings = await prisma.$transaction(
    async (tx) => {
      let gravadas = 0
      for (const par of pares) {
        // A chave composta e o que torna isto idempotente: a mesma reimpressao
        // vista de novo nao acrescenta linha.
        await tx.variantPrinting.upsert({
          where: { cardVariantId_setId: par },
          create: par,
          update: {},
        })
        gravadas += 1
      }
      return gravadas
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  )

  return { printings, withoutBase }
}

/**
 * Reconcilia cores, traits, atributos e mecanicas da carta.
 *
 * Substitui o conjunto inteiro em vez de so acrescentar, para que um valor
 * removido na fonte tambem desapareca aqui. Como o vocabulario e casado por
 * nome, rodar de novo nao cria termo duplicado.
 */
async function syncVocabulary(
  tx: Prisma.TransactionClient,
  cardId: bigint,
  card: CardDTO,
): Promise<void> {
  const colorIds = await upsertNames(card.colors, (name) =>
    tx.color.upsert({ where: { name }, create: { name }, update: {} }),
  )
  const traitIds = await upsertNames(card.traits, (name) =>
    tx.trait.upsert({ where: { name }, create: { name }, update: {} }),
  )
  const attributeIds = await upsertNames(card.attributes, (name) =>
    tx.attribute.upsert({ where: { name }, create: { name }, update: {} }),
  )
  const mechanicIds = await upsertNames(card.mechanics, (name) =>
    tx.mechanic.upsert({ where: { name }, create: { name }, update: {} }),
  )

  await tx.cardColor.deleteMany({ where: { cardId } })
  await tx.cardTrait.deleteMany({ where: { cardId } })
  await tx.cardAttribute.deleteMany({ where: { cardId } })
  await tx.cardMechanic.deleteMany({ where: { cardId } })

  if (colorIds.length > 0) {
    await tx.cardColor.createMany({ data: colorIds.map((colorId) => ({ cardId, colorId })) })
  }
  if (traitIds.length > 0) {
    await tx.cardTrait.createMany({ data: traitIds.map((traitId) => ({ cardId, traitId })) })
  }
  if (attributeIds.length > 0) {
    await tx.cardAttribute.createMany({
      data: attributeIds.map((attributeId) => ({ cardId, attributeId })),
    })
  }
  if (mechanicIds.length > 0) {
    await tx.cardMechanic.createMany({
      data: mechanicIds.map((mechanicId) => ({ cardId, mechanicId })),
    })
  }
}

async function upsertNames(
  names: string[],
  upsert: (name: string) => Promise<{ id: bigint }>,
): Promise<bigint[]> {
  const ids: bigint[] = []
  for (const name of [...new Set(names)]) {
    const row = await upsert(name)
    ids.push(row.id)
  }
  return ids
}
