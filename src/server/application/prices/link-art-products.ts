import type { PrismaClient } from '@prisma/client'
import type { PriceProvider, SourceArtProduct } from '@/server/http/price-provider'

/**
 * Vincular cada arte nossa ao produto correspondente na fonte.
 *
 * Camada: application.
 *
 * ## Por que isto precisa existir
 *
 * O código da carta identifica a carta, não a arte. O nosso catálogo separa
 * apenas Normal de Parallel (decisão 023), então uma carta com três paralelas
 * tem três linhas indistinguíveis entre si — e a fonte tem três produtos, cada
 * um com nome e preço próprios. Ninguém consegue dizer qual é qual sem olhar.
 *
 * ## A arte comum passou a entrar, e o motivo mudou
 *
 * A decisão 053 a deixou de fora: o preço dela é derivado por regra a cada
 * importação, e materializar o derivável cria uma segunda verdade.
 *
 * A folha em JPEG mudou isso (decisão 058). Ela precisa do id do produto **na
 * hora de desenhar**, no navegador de quem usa — e ali não dá para rodar a
 * regra, que exige ler os 87 arquivos da fonte. O vínculo deixou de ser só
 * atalho de preço e virou a referência de imagem.
 *
 * O que se guarda é o **número do produto**, nunca a imagem: ela continua sendo
 * buscada na origem pelo aparelho de quem usa.
 *
 * ## Só o caso sem escolha
 *
 * Esta função vincula **exatamente um** cenário: a carta tem uma paralela só do
 * nosso lado, e a fonte oferece uma arte só além da comum. Aí não há o que
 * escolher, e casar é dedução, não palpite.
 *
 * Com duas de cada lado a resposta depende de saber qual é a *Alternate Art* e
 * qual é a *Manga* — e isso é olho humano. Essas ficam para o mapeamento manual
 * e entram com `origin = 'manual'`.
 *
 * ## O vínculo manual nunca é sobrescrito
 *
 * É o ponto que torna isto sustentável a longo prazo. Vínculo automático sai de
 * uma regra e pode ser refeito quantas vezes for preciso — se a fonte mudar, a
 * próxima passada corrige. Vínculo manual custou o tempo do dono do produto, e
 * uma rederivação que o apagasse tornaria o trabalho manual impossível de
 * confiar.
 */

export interface LinkArtProductsResult {
  /** Cartas com paralela no nosso catálogo. */
  cards: number
  /** Vínculos automáticos criados nesta passada. */
  created: number
  /** Já existiam, apontando para o mesmo produto. */
  unchanged: number
  /** Automáticos que mudaram de produto porque a fonte mudou. */
  updated: number
  /** Cartas em que há mais de uma arte dos dois lados: precisam de olho humano. */
  ambiguous: number
  /** Cartas cuja arte a fonte não oferece. */
  withoutSource: number
  /** Preservados por serem manuais. */
  manualKept: number
}

export interface LinkArtProductsOptions {
  logger?: Pick<Console, 'info' | 'warn'>
}

export async function linkArtProducts(
  prisma: PrismaClient,
  provider: PriceProvider,
  options: LinkArtProductsOptions = {},
): Promise<LinkArtProductsResult> {
  const logger = options.logger ?? console

  const cards = await prisma.card.findMany({ select: { code: true, name: true } })
  const knownNames = new Map(cards.map((card) => [card.code.toUpperCase(), card.name]))

  const { arts, commonArts } = await provider.fetchSnapshot(knownNames)
  const artsByCode = groupByCode(arts)

  const normais = await prisma.cardVariant.findMany({
    where: { variantType: 'Normal' },
    select: { id: true, card: { select: { code: true } } },
  })
  const normalPorCarta = new Map<string, bigint[]>()
  for (const variant of normais) {
    const code = variant.card.code.toUpperCase()
    const list = normalPorCarta.get(code)
    if (list) list.push(variant.id)
    else normalPorCarta.set(code, [variant.id])
  }

  const nossas = await prisma.cardVariant.findMany({
    where: { variantType: 'Parallel' },
    select: { id: true, card: { select: { code: true } } },
    orderBy: { sourceId: 'asc' },
  })

  const nossasPorCarta = new Map<string, bigint[]>()
  for (const variant of nossas) {
    const code = variant.card.code.toUpperCase()
    const list = nossasPorCarta.get(code)
    if (list) list.push(variant.id)
    else nossasPorCarta.set(code, [variant.id])
  }

  const existentes = await prisma.variantSourceProduct.findMany({
    where: { source: provider.name },
    select: { cardVariantId: true, sourceProductId: true, origin: true },
  })
  const porVariante = new Map(existentes.map((row) => [String(row.cardVariantId), row]))

  const result: LinkArtProductsResult = {
    cards: nossasPorCarta.size,
    created: 0,
    unchanged: 0,
    updated: 0,
    ambiguous: 0,
    withoutSource: 0,
    manualKept: 0,
  }

  /*
   * A arte comum primeiro. Ela nunca é ambígua — a regra da decisão 050 já
   * decidiu qual produto é —, então aqui é só gravar o vínculo. Códigos com
   * mais de uma variante Normal ficam de fora: não deveria acontecer, e se
   * acontecer é ambiguidade, que não vira palpite.
   */
  for (const common of commonArts) {
    const ids = normalPorCarta.get(common.cardCode.toUpperCase())
    if (!ids || ids.length !== 1) continue

    const cardVariantId = ids[0]
    const atual = porVariante.get(String(cardVariantId))

    if (atual?.origin === 'manual') {
      result.manualKept++
      continue
    }
    if (atual?.sourceProductId === common.productId) {
      result.unchanged++
      continue
    }

    await prisma.variantSourceProduct.upsert({
      where: { cardVariantId_source: { cardVariantId, source: provider.name } },
      create: {
        cardVariantId,
        source: provider.name,
        sourceProductId: common.productId,
        origin: 'automatic',
      },
      update: {
        sourceProductId: common.productId,
        origin: 'automatic',
        confirmedAt: new Date(),
      },
    })

    if (atual) result.updated++
    else result.created++
  }

  for (const [code, variantIds] of nossasPorCarta) {
    const daFonte = artsByCode.get(code) ?? []

    if (daFonte.length === 0) {
      result.withoutSource++
      continue
    }
    if (variantIds.length !== 1 || daFonte.length !== 1) {
      result.ambiguous++
      continue
    }

    const cardVariantId = variantIds[0]
    const productId = daFonte[0].productId
    const atual = porVariante.get(String(cardVariantId))

    if (atual?.origin === 'manual') {
      result.manualKept++
      continue
    }
    if (atual?.sourceProductId === productId) {
      result.unchanged++
      continue
    }

    await prisma.variantSourceProduct.upsert({
      where: { cardVariantId_source: { cardVariantId, source: provider.name } },
      create: {
        cardVariantId,
        source: provider.name,
        sourceProductId: productId,
        origin: 'automatic',
      },
      update: { sourceProductId: productId, origin: 'automatic', confirmedAt: new Date() },
    })

    if (atual) result.updated++
    else result.created++
  }

  logger.info(
    `[vinculo] ${result.cards} cartas com paralela: ${result.created} novos, ` +
      `${result.unchanged} sem mudanca, ${result.updated} atualizados, ` +
      `${result.ambiguous} ambiguos, ${result.withoutSource} sem oferta, ` +
      `${result.manualKept} manuais preservados`,
  )

  return result
}

function groupByCode(arts: readonly SourceArtProduct[]): Map<string, SourceArtProduct[]> {
  const byCode = new Map<string, SourceArtProduct[]>()
  for (const art of arts) {
    const code = art.cardCode.toUpperCase()
    const list = byCode.get(code)
    if (list) list.push(art)
    else byCode.set(code, [art])
  }
  return byCode
}
