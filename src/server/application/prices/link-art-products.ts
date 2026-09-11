import type { PrismaClient } from '@prisma/client'
import type { ManualLink } from '@/server/domain/prices/manual-links'
import { deduceArtPairs } from '@/server/domain/prices/rarity-deduction'
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
 * ## Três origens de vínculo, em ordem
 *
 * 1. **O arquivo manual** (`data/vinculos-manuais.json`, decisão 068). É o
 *    julgamento do dono do produto, e vence tudo: aplicado primeiro, como
 *    `origin = 'manual'`, e os produtos que ele reivindica saem da mesa antes de
 *    qualquer regra.
 * 2. **A dedução por raridade** (068): `SP CARD` só pode ser o `SP`, `TR` só pode
 *    ser o `TR`, quando cada um é o único do seu lado.
 * 3. **O caso sem escolha** (053): sobrou uma arte de cada lado, e casar é
 *    dedução, não palpite.
 *
 * O que sobra depois disso é olho humano, e é o que a tela de mapeamento mostra.
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
  /** Dos pares automáticos, quantos saíram da raridade. */
  deducedByRarity: number
  /** Cartas em que sobrou arte sem par dos dois lados: precisam de olho humano. */
  ambiguous: number
  /** Cartas cuja arte a fonte não oferece. */
  withoutSource: number
  /** Manuais que já estavam no banco e o arquivo não mencionou: preservados. */
  manualKept: number
  /** Linhas do arquivo manual aplicadas com produto. */
  manualApplied: number
  /** Linhas do arquivo com `produto: null`: a arte fica sem vínculo, de propósito. */
  manualCleared: number
  /** Linhas do arquivo que não puderam ser aplicadas — ver o aviso de cada uma. */
  manualSkipped: number
}

export interface LinkArtProductsOptions {
  logger?: Pick<Console, 'info' | 'warn'>
  /**
   * O conteúdo de `data/vinculos-manuais.json`.
   *
   * Opcional só para os testes que não falam dele. Os dois caminhos de produção
   * — `prices:import` e `supabase prices` — sempre o passam, e é por eles que o
   * trabalho manual chega a todo ambiente.
   */
  manualLinks?: readonly ManualLink[]
}

type Existente = { cardVariantId: bigint; sourceProductId: string; origin: string }

export async function linkArtProducts(
  prisma: PrismaClient,
  provider: PriceProvider,
  options: LinkArtProductsOptions = {},
): Promise<LinkArtProductsResult> {
  const logger = options.logger ?? console
  const source = provider.name

  const cards = await prisma.card.findMany({ select: { code: true, name: true } })
  const knownNames = new Map(cards.map((card) => [card.code.toUpperCase(), card.name]))

  const { arts, commonArts } = await provider.fetchSnapshot(knownNames)
  const artsByCode = groupByCode(arts)

  const result: LinkArtProductsResult = {
    cards: 0,
    created: 0,
    unchanged: 0,
    updated: 0,
    deducedByRarity: 0,
    ambiguous: 0,
    withoutSource: 0,
    manualKept: 0,
    manualApplied: 0,
    manualCleared: 0,
    manualSkipped: 0,
  }

  /*
   * O arquivo manual primeiro. Ele e o julgamento do dono do produto: nenhuma
   * regra roda sobre uma arte que ele respondeu, e nenhuma regra pode dar a outra
   * arte um produto que ele reivindicou.
   */
  const variantesDoArquivo = await applyManualLinks(
    prisma,
    source,
    options.manualLinks ?? [],
    { arts, commonArts },
    result,
    logger,
  )

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
    select: { id: true, rarity: true, card: { select: { code: true } } },
    orderBy: { sourceId: 'asc' },
  })

  const nossasPorCarta = new Map<string, { id: bigint; rarity: string | null }[]>()
  for (const variant of nossas) {
    const code = variant.card.code.toUpperCase()
    const list = nossasPorCarta.get(code)
    const entry = { id: variant.id, rarity: variant.rarity }
    if (list) list.push(entry)
    else nossasPorCarta.set(code, [entry])
  }
  result.cards = nossasPorCarta.size

  // Lido depois do arquivo manual, para ja refletir o que ele escreveu.
  const existentes: Existente[] = await prisma.variantSourceProduct.findMany({
    where: { source },
    select: { cardVariantId: true, sourceProductId: true, origin: true },
  })
  const porVariante = new Map(existentes.map((row) => [String(row.cardVariantId), row]))
  const reivindicados = new Set(
    existentes.filter((row) => row.origin === 'manual').map((row) => row.sourceProductId),
  )

  /*
   * A arte comum. Ela nunca é ambígua — a regra da decisão 050 já decidiu qual
   * produto é —, então aqui é só gravar o vínculo. Códigos com mais de uma
   * variante Normal ficam de fora: não deveria acontecer, e se acontecer é
   * ambiguidade, que não vira palpite.
   */
  for (const common of commonArts) {
    const ids = normalPorCarta.get(common.cardCode.toUpperCase())
    if (!ids || ids.length !== 1) continue

    const cardVariantId = ids[0]
    const atual = porVariante.get(String(cardVariantId))

    if (atual?.origin === 'manual') {
      if (!variantesDoArquivo.has(String(cardVariantId))) result.manualKept++
      continue
    }
    if (atual?.sourceProductId === common.productId) {
      result.unchanged++
      continue
    }

    await linkAutomatic(prisma, source, cardVariantId, common.productId)
    if (atual) result.updated++
    else result.created++
  }

  for (const [code, variantes] of nossasPorCarta) {
    const daFonte = artsByCode.get(code) ?? []

    if (daFonte.length === 0) {
      result.withoutSource++
      continue
    }

    const livres = variantes.filter((variant) => {
      const id = String(variant.id)
      const manual = porVariante.get(id)?.origin === 'manual'
      if (manual && !variantesDoArquivo.has(id)) result.manualKept++
      return !manual && !variantesDoArquivo.has(id)
    })
    if (livres.length === 0) continue

    const { pairs, viaRarity, leftoverOurs, leftoverTheirs } = deduceArtPairs(
      livres.map((variant) => ({ variantId: String(variant.id), rarity: variant.rarity })),
      daFonte
        .filter((art) => !reivindicados.has(art.productId))
        .map((art) => ({ productId: art.productId, label: art.label })),
    )

    result.deducedByRarity += viaRarity
    if (leftoverOurs.length > 0 && leftoverTheirs.length > 0) result.ambiguous++

    for (const pair of pairs) {
      const atual = porVariante.get(pair.variantId)
      if (atual?.sourceProductId === pair.productId) {
        result.unchanged++
        continue
      }

      await linkAutomatic(prisma, source, BigInt(pair.variantId), pair.productId)
      if (atual) result.updated++
      else result.created++
    }
  }

  logger.info(
    `[vinculo] ${result.cards} cartas com paralela: ${result.created} novos ` +
      `(${result.deducedByRarity} por raridade), ${result.unchanged} sem mudanca, ` +
      `${result.updated} atualizados, ${result.ambiguous} ambiguos, ` +
      `${result.withoutSource} sem oferta | manual: ${result.manualApplied} aplicados, ` +
      `${result.manualCleared} sem produto, ${result.manualSkipped} recusados, ` +
      `${result.manualKept} preservados`,
  )

  return result
}

/**
 * Grava um vínculo automático, soltando antes quem segurava o mesmo produto.
 *
 * O índice único `(source, source_product_id)` recusaria o upsert se outra arte
 * da mesma carta já tivesse este produto — o que acontece quando a dedução muda
 * de ideia de uma passada para outra. Só se solta vínculo **automático**: o
 * manual nunca chega aqui, porque os produtos dele saíram da mesa antes.
 */
async function linkAutomatic(
  prisma: PrismaClient,
  source: string,
  cardVariantId: bigint,
  productId: string,
): Promise<void> {
  await prisma.variantSourceProduct.deleteMany({
    where: { source, sourceProductId: productId, origin: 'automatic', NOT: { cardVariantId } },
  })
  await prisma.variantSourceProduct.upsert({
    where: { cardVariantId_source: { cardVariantId, source } },
    create: { cardVariantId, source, sourceProductId: productId, origin: 'automatic' },
    update: { sourceProductId: productId, origin: 'automatic', confirmedAt: new Date() },
  })
}

/**
 * Aplica o arquivo manual e devolve as artes que ele cobriu.
 *
 * Cada linha é conferida contra o catálogo e contra a fonte, e a que não fecha é
 * **recusada com aviso**, e não aplicada no escuro:
 *
 * - arte que não existe no catálogo — um `source_id` digitado errado;
 * - produto que a fonte não lista **para aquela carta** — um id trocado, ou um
 *   produto que a fonte tirou do ar. Vincular assim daria à carta uma imagem que
 *   não carrega na folha, pior que a arte do catálogo que ela teria sem vínculo.
 *
 * Recusar a linha, e não a importação inteira: um erro de digitação num
 * mapeamento não é motivo para produção ficar sem preço nenhum naquela noite.
 */
async function applyManualLinks(
  prisma: PrismaClient,
  source: string,
  links: readonly ManualLink[],
  snapshot: { arts: readonly SourceArtProduct[]; commonArts: readonly { cardCode: string; productId: string }[] },
  result: LinkArtProductsResult,
  logger: Pick<Console, 'warn'>,
): Promise<Set<string>> {
  const cobertas = new Set<string>()
  if (links.length === 0) return cobertas

  const alvos = await prisma.cardVariant.findMany({
    where: { sourceId: { in: links.map((link) => link.variante) } },
    select: { id: true, sourceId: true, card: { select: { code: true } } },
  })
  const porSourceId = new Map(alvos.map((variant) => [variant.sourceId, variant]))

  const cartaDoProduto = new Map<string, string>()
  for (const art of snapshot.arts) cartaDoProduto.set(art.productId, art.cardCode.toUpperCase())
  for (const common of snapshot.commonArts) {
    cartaDoProduto.set(common.productId, common.cardCode.toUpperCase())
  }

  for (const link of links) {
    const alvo = porSourceId.get(link.variante)
    if (!alvo) {
      logger.warn(`[vinculo] manual recusado: a arte ${link.variante} nao existe no catalogo`)
      result.manualSkipped++
      continue
    }

    const cardVariantId = alvo.id

    if (link.produto === null) {
      await prisma.variantSourceProduct.deleteMany({ where: { cardVariantId, source } })
      cobertas.add(String(cardVariantId))
      result.manualCleared++
      continue
    }

    if (cartaDoProduto.get(link.produto) !== alvo.card.code.toUpperCase()) {
      logger.warn(
        `[vinculo] manual recusado: o produto ${link.produto} nao e uma arte de ` +
          `${alvo.card.code} na fonte (${link.variante})`,
      )
      result.manualSkipped++
      continue
    }

    // O arquivo vence: quem segurava este produto o solta, automatico ou nao.
    await prisma.variantSourceProduct.deleteMany({
      where: { source, sourceProductId: link.produto, NOT: { cardVariantId } },
    })
    await prisma.variantSourceProduct.upsert({
      where: { cardVariantId_source: { cardVariantId, source } },
      create: { cardVariantId, source, sourceProductId: link.produto, origin: 'manual' },
      update: { sourceProductId: link.produto, origin: 'manual', confirmedAt: new Date() },
    })
    cobertas.add(String(cardVariantId))
    result.manualApplied++
  }

  return cobertas
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
