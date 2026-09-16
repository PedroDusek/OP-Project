import type { PrismaClient } from '@prisma/client'
import type { LigaCardEntry } from '@/server/domain/catalog/liga-cards'
import {
  deduceByLigaTreatment,
  ligaIdentity,
  sourceTreatmentKey,
  type LigaArt,
} from '@/server/domain/prices/liga-treatment'
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
 * ## Quatro origens de vínculo, em ordem
 *
 * 1. **O arquivo manual** (`data/vinculos-manuais.json`, decisão 068). É o
 *    julgamento do dono do produto, e vence tudo: aplicado primeiro, como
 *    `origin = 'manual'`, e os produtos que ele reivindica saem da mesa antes de
 *    qualquer regra.
 * 2. **O tratamento conferido na Liga** (072): a arte tem nome na tabela da
 *    Liga, e o nome casa com um produto só. Antes da raridade porque é
 *    identidade conferida por gente, e não dedução.
 * 3. **A dedução por raridade** (068): `SP CARD` só pode ser o `SP`, `TR` só pode
 *    ser o `TR`, quando cada um é o único do seu lado.
 * 4. **O caso sem escolha** (053): sobrou uma arte de cada lado, e casar é
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
  /** Dos pares automáticos, quantos saíram do tratamento conferido na Liga (072). */
  deducedByLiga: number
  /**
   * Pares que a raridade ou o caso sem escolha formariam, recusados porque a Liga
   * dá à arte outro tratamento que o do produto.
   */
  refusedByLiga: number
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
  /**
   * O conteúdo de `data/liga-cartas.json` (decisão 071), para a regra da Liga
   * (072). Sem ele, a regra não roda — e as outras seguem como antes.
   */
  ligaCards?: readonly LigaCardEntry[]
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

  const { arts, commonArts, otherProducts } = await provider.fetchSnapshot(knownNames)
  const artsByCode = groupByCode(arts)
  const otherByCode = groupByCode(otherProducts)
  const ligaPorArte = new Map((options.ligaCards ?? []).map((entry) => [entry.arte, entry.url]))

  const result: LinkArtProductsResult = {
    cards: 0,
    created: 0,
    unchanged: 0,
    updated: 0,
    deducedByRarity: 0,
    deducedByLiga: 0,
    refusedByLiga: 0,
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
    { arts, otherProducts, commonArts },
    result,
    logger,
  )

  const normais = await prisma.cardVariant.findMany({
    where: { variantType: 'Normal' },
    select: {
      id: true,
      card: { select: { code: true } },
      printings: { select: { set: { select: { code: true } } } },
    },
  })
  const normalPorCarta = new Map<string, bigint[]>()
  const setsDaNormal = new Map<string, string[]>()
  for (const variant of normais) {
    const code = variant.card.code.toUpperCase()
    const list = normalPorCarta.get(code)
    if (list) list.push(variant.id)
    else normalPorCarta.set(code, [variant.id])
    setsDaNormal.set(code, [
      ...(setsDaNormal.get(code) ?? []),
      ...variant.printings.map((printing) => printing.set.code),
    ])
  }

  const nossas = await prisma.cardVariant.findMany({
    where: { variantType: 'Parallel' },
    select: {
      id: true,
      sourceId: true,
      rarity: true,
      card: { select: { code: true, name: true } },
      printings: { select: { set: { select: { code: true } } } },
    },
    orderBy: { sourceId: 'asc' },
  })

  type Nossa = {
    id: bigint
    sourceId: string | null
    rarity: string | null
    cardName: string
    sets: string[]
  }
  const nossasPorCarta = new Map<string, Nossa[]>()
  for (const variant of nossas) {
    const code = variant.card.code.toUpperCase()
    const list = nossasPorCarta.get(code)
    const entry: Nossa = {
      id: variant.id,
      sourceId: variant.sourceId,
      rarity: variant.rarity,
      cardName: variant.card.name,
      sets: variant.printings.map((printing) => printing.set.code),
    }
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
    const outrosDaFonte = otherByCode.get(code) ?? []

    if (daFonte.length === 0 && outrosDaFonte.length === 0) {
      result.withoutSource++
      continue
    }

    let livres = variantes.filter((variant) => {
      const id = String(variant.id)
      const manual = porVariante.get(id)?.origin === 'manual'
      if (manual && !variantesDoArquivo.has(id)) result.manualKept++
      return !manual && !variantesDoArquivo.has(id)
    })
    if (livres.length === 0) continue

    /*
     * O tratamento conferido na Liga (decisao 072), contra as artes e os demais
     * produtos da carta. O que ele casa sai da mesa das regras seguintes.
     */
    const artesDaLiga: LigaArt[] = livres.map((variant) => ({
      variantId: String(variant.id),
      cardCode: code,
      ligaUrl: variant.sourceId ? ligaPorArte.get(variant.sourceId) : undefined,
      rarity: variant.rarity,
      cardName: variant.cardName,
      parallelSets: variant.sets,
      normalSets: setsDaNormal.get(code) ?? [],
    }))
    const ligaPares = deduceByLigaTreatment(
      artesDaLiga,
      [...daFonte, ...outrosDaFonte]
        .filter((art) => !reivindicados.has(art.productId))
        .map((art) => ({ productId: art.productId, label: art.label, groupCode: art.groupCode })),
    )
    const casadasPelaLiga = new Set(ligaPares.map((pair) => pair.variantId))
    const produtosDaLiga = new Set(ligaPares.map((pair) => pair.productId))
    result.deducedByLiga += ligaPares.length
    for (const pair of ligaPares) {
      const atual = porVariante.get(pair.variantId)
      if (atual?.sourceProductId === pair.productId) {
        result.unchanged++
        continue
      }
      await linkAutomatic(prisma, source, BigInt(pair.variantId), pair.productId)
      if (atual) result.updated++
      else result.created++
    }
    livres = livres.filter((variant) => !casadasPelaLiga.has(String(variant.id)))
    if (livres.length === 0 || daFonte.length === 0) continue

    const { pairs, viaRarity, leftoverOurs, leftoverTheirs } = deduceArtPairs(
      livres.map((variant) => ({ variantId: String(variant.id), rarity: variant.rarity })),
      daFonte
        .filter((art) => !reivindicados.has(art.productId) && !produtosDaLiga.has(art.productId))
        .map((art) => ({ productId: art.productId, label: art.label })),
    )

    result.deducedByRarity += viaRarity
    if (leftoverOurs.length > 0 && leftoverTheirs.length > 0) result.ambiguous++

    /*
     * A raridade e o caso sem escolha nao sabem o nome da arte; a Liga sabe. Um
     * par em que a Liga diz `Manga` e o produto e `Alternate Art` e recusado,
     * mesmo que tenha sobrado uma de cada lado: medido na primeira passada, a
     * `OP09-078_p2` (Manga) ia para uma Alternate Art de US$ 923.
     */
    const identidadeDaLiga = new Map(artesDaLiga.map((art) => [art.variantId, ligaIdentity(art)]))
    const nomeDaCarta = artesDaLiga[0]?.cardName
    const rotulo = new Map(daFonte.map((art) => [art.productId, art.label]))
    const coerentes = pairs.filter((pair) => {
      const identidade = identidadeDaLiga.get(pair.variantId)
      if (!identidade || identidade.chave === null) return true
      const doProduto = sourceTreatmentKey(rotulo.get(pair.productId) ?? '', nomeDaCarta)
      // Sem tratamento em outra colecao (a Nami do ST31), so serve produto sem
      // tratamento: medido, a `OP01-016_p9` ia para uma SP da EB-05.
      return doProduto === (identidade.tratamento ?? '')
    })
    result.refusedByLiga += pairs.length - coerentes.length

    for (const pair of coerentes) {
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
      `(${result.deducedByLiga} pela Liga, ${result.deducedByRarity} por raridade, ` +
      `${result.refusedByLiga} recusados pela Liga), ` +
      `${result.unchanged} sem mudanca, ` +
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
  snapshot: {
    arts: readonly SourceArtProduct[]
    otherProducts: readonly SourceArtProduct[]
    commonArts: readonly { cardCode: string; productId: string }[]
  },
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
  for (const art of [...snapshot.arts, ...snapshot.otherProducts]) {
    cartaDoProduto.set(art.productId, art.cardCode.toUpperCase())
  }
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
