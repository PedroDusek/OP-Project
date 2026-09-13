import 'dotenv/config'
import { linkArtProducts } from '@/server/application/prices/link-art-products'
import { pendingParallels, type CandidateSourceArt } from '@/server/domain/prices/parallel-candidates'
import { loadManualLinks } from '@/server/infrastructure/prices/manual-links-file'
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

    await linkArtProducts(prisma, provider, { manualLinks: manual })

    const cards = await prisma.card.findMany({ select: { code: true, name: true } })
    const knownNames = new Map(cards.map((card) => [card.code.toUpperCase(), card.name]))
    const { arts } = await provider.fetchSnapshot(knownNames)

    const artsByCode = new Map<string, CandidateSourceArt[]>()
    for (const art of arts) {
      const code = art.cardCode.toUpperCase()
      const entry = { productId: art.productId, label: art.label, value: art.value }
      artsByCode.set(code, [...(artsByCode.get(code) ?? []), entry])
    }

    const paralelas = await prisma.cardVariant.findMany({
      where: { variantType: 'Parallel', sourceId: { not: null } },
      select: {
        sourceId: true,
        rarity: true,
        imageUrl: true,
        card: { select: { code: true, name: true } },
        printings: { select: { set: { select: { code: true } } }, take: 1 },
      },
      orderBy: { sourceId: 'asc' },
    })

    const porCarta = new Map<
      string,
      { code: string; name: string; setCode: string | null; parallels: { sourceId: string; rarity: string | null; imageUrl: string | null }[] }
    >()
    for (const v of paralelas) {
      const atual = porCarta.get(v.card.code) ?? {
        code: v.card.code,
        name: v.card.name,
        setCode: v.printings[0]?.set.code ?? null,
        parallels: [],
      }
      atual.parallels.push({ sourceId: v.sourceId!, rarity: v.rarity, imageUrl: v.imageUrl })
      porCarta.set(v.card.code, atual)
    }

    const vinculos = await prisma.variantSourceProduct.findMany({
      where: { source: provider.name },
      select: { sourceProductId: true, cardVariant: { select: { sourceId: true } } },
    })

    const pendentes = pendingParallels({
      cards: [...porCarta.values()],
      linkedSourceIds: new Set(
        vinculos.map((v) => v.cardVariant.sourceId).filter((id): id is string => id !== null),
      ),
      claimedProductIds: new Set(vinculos.map((v) => v.sourceProductId)),
      answeredSourceIds: new Set(manual.map((link) => link.variante)),
      artsByCode,
    })

    saveParallelCandidates(pendentes)

    const artes = pendentes.reduce((total, carta) => total + carta.ours.length, 0)
    console.log(`[candidatos] ${pendentes.length} cartas pendentes, ${artes} artes nossas sem par`)
    console.log('[candidatos] escrito: paralelas-candidatas.json — abra /dev/paralelas')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('[candidatos] falhou:', error instanceof Error ? error.message : error)
  process.exit(1)
})
