import 'dotenv/config'
import { linkArtProducts } from '@/server/application/prices/link-art-products'
import { placementSet } from '@/server/domain/catalog/order'
import {
  mappingCandidates,
  type CandidateInputArt,
  type CandidateInputCard,
  type CandidateSourceArt,
} from '@/server/domain/prices/parallel-candidates'
import { loadManualLinks } from '@/server/infrastructure/prices/manual-links-file'
import { loadLigaCards } from '@/server/infrastructure/catalog/liga-cards-file'
import { oncePerRun } from '@/server/infrastructure/prices/once-per-run'
import { saveParallelCandidates } from '@/server/infrastructure/prices/parallel-candidates-file'
import { TcgCsvPriceProvider } from '@/server/infrastructure/prices/tcgcsv-price-provider'
import { createPrisma } from '@/server/infrastructure/prisma'

/**
 * Gera o levantamento que a tela `/dev/paralelas` mostra.
 *
 *   npm run paralelas:candidatos
 *
 * Roda o vínculo primeiro — com o arquivo manual e a dedução por raridade —, e
 * só então calcula o que sobrou, a partir do **mesmo** snapshot da fonte. Assim o
 * levantamento nunca descreve um banco desatualizado, e a fonte é lida uma vez só
 * (decisão 020).
 *
 * Com a carta entram todas as artes e todos os produtos dela, com o dono de cada
 * um e o que a página da Liga aponta (decisão 077).
 *
 * Grava no banco **local**, como `prices:import`. Produção só pelo
 * `npm run supabase prices`, que aplica o mesmo arquivo manual.
 */

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL nao esta definida.')

  const prisma = createPrisma(url)
  try {
    const provider = oncePerRun(new TcgCsvPriceProvider())
    const manual = loadManualLinks()
    const ligaCards = loadLigaCards()

    await linkArtProducts(prisma, provider, { manualLinks: manual, ligaCards })

    const cards = await prisma.card.findMany({ select: { code: true, name: true } })
    const knownNames = new Map(cards.map((card) => [card.code.toUpperCase(), card.name]))
    const { arts, otherProducts, commonArts, prices } = await provider.fetchSnapshot(knownNames)

    const variantes = await prisma.cardVariant.findMany({
      where: { sourceId: { not: null } },
      select: {
        sourceId: true,
        variantType: true,
        rarity: true,
        imageUrl: true,
        card: { select: { code: true, name: true } },
        printings: { select: { set: { select: { code: true } } } },
        sourceProducts: { where: { source: provider.name }, select: { sourceProductId: true, origin: true } },
      },
      orderBy: { sourceId: 'asc' },
    })

    const dono = new Map<string, string>()
    for (const v of variantes) for (const l of v.sourceProducts) dono.set(l.sourceProductId, v.sourceId!)

    // Todos os produtos de cada carta: a arte comum, as artes e o resto.
    const precoDaComum = new Map(prices.map((price) => [price.cardCode.toUpperCase(), price.value]))
    const productsByCode = new Map<string, CandidateSourceArt[]>()
    const valorDoProduto = new Map<string, number | null>()
    const acrescentar = (code: string, produto: Omit<CandidateSourceArt, 'dono'>) => {
      const chave = code.toUpperCase()
      const daCarta = productsByCode.get(chave) ?? []
      if (daCarta.some((p) => p.productId === produto.productId)) return
      valorDoProduto.set(produto.productId, produto.value)
      productsByCode.set(chave, [...daCarta, { ...produto, dono: dono.get(produto.productId) ?? null }])
    }
    for (const common of commonArts) {
      acrescentar(common.cardCode, {
        productId: common.productId,
        label: '',
        value: precoDaComum.get(common.cardCode.toUpperCase()) ?? null,
        groupCode: common.groupCode ?? null,
      })
    }
    for (const art of [...arts, ...otherProducts]) {
      acrescentar(art.cardCode, {
        productId: art.productId,
        label: art.label,
        value: art.value,
        groupCode: art.groupCode ?? null,
      })
    }

    const liga = new Map(ligaCards.map((entry) => [entry.arte, entry.url]))
    const porCarta = new Map<string, CandidateInputCard & { arts: CandidateInputArt[] }>()
    for (const v of variantes) {
      const code = v.card.code
      const carta = porCarta.get(code) ?? { code, name: v.card.name, setCode: null, arts: [] }
      const vinculo = v.sourceProducts[0]
      carta.arts.push({
        sourceId: v.sourceId!,
        variantType: v.variantType === 'Normal' ? 'Normal' : 'Parallel',
        rarity: v.rarity,
        imageUrl: v.imageUrl,
        sets: v.printings.map((p) => p.set.code),
        atual: vinculo
          ? { productId: vinculo.sourceProductId, origin: vinculo.origin === 'manual' ? 'manual' : 'automatic' }
          : null,
        ligaUrl: liga.get(v.sourceId!),
      })
      porCarta.set(code, carta)
    }
    for (const carta of porCarta.values()) {
      carta.setCode = placementSet(carta.code, carta.arts.flatMap((art) => art.sets))
    }

    // A normal tem preco pela arte comum, ou pelo produto do vinculo manual.
    const pricedNormals = new Set(
      variantes
        .filter((v) => v.variantType === 'Normal')
        .filter((v) => {
          if (precoDaComum.has(v.card.code.toUpperCase())) return true
          const produto = v.sourceProducts[0]?.sourceProductId
          return produto !== undefined && (valorDoProduto.get(produto) ?? null) !== null
        })
        .map((v) => v.sourceId!),
    )

    const cartas = mappingCandidates({
      cards: [...porCarta.values()],
      manual: new Map(manual.map((link) => [link.variante, { produto: link.produto, nota: link.nota }])),
      productsByCode,
      pricedNormals,
    })

    saveParallelCandidates(cartas)

    const motivos = new Map<string, number>()
    for (const carta of cartas) {
      for (const art of carta.ours) if (art.motivo) motivos.set(art.motivo, (motivos.get(art.motivo) ?? 0) + 1)
    }
    const resumo = [...motivos].map(([motivo, n]) => `${n} ${motivo}`).join(', ')
    console.log(`[candidatos] ${cartas.length} cartas: ${resumo}`)
    console.log('[candidatos] escrito: paralelas-candidatas.json — abra /dev/paralelas')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('[candidatos] falhou:', error instanceof Error ? error.message : error)
  process.exit(1)
})
