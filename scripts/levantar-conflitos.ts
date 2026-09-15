import 'dotenv/config'
import { ligaConflict } from '@/server/domain/prices/liga-conflicts'
import { loadLigaCards } from '@/server/infrastructure/catalog/liga-cards-file'
import { saveLigaConflicts, type LigaConflict } from '@/server/infrastructure/prices/liga-conflicts-file'
import { TcgCsvPriceProvider } from '@/server/infrastructure/prices/tcgcsv-price-provider'
import { createPrisma } from '@/server/infrastructure/prisma'

/**
 * Gera o levantamento que a tela `/dev/liga/conflitos` mostra.
 *
 *   npm run liga:conflitos
 *
 * Os vínculos automáticos de paralela cujo produto discorda do nome que a Liga
 * conferiu (decisão 074). Lê a fonte de preço uma vez e o banco **local**; não
 * grava no banco — quem aplica a resposta é a importação de preço, pelo arquivo
 * de vínculos manuais.
 */

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL nao esta definida.')

  const prisma = createPrisma(url)
  try {
    const cards = await prisma.card.findMany({ select: { code: true, name: true } })
    const snapshot = await new TcgCsvPriceProvider().fetchSnapshot(
      new Map(cards.map((card) => [card.code.toUpperCase(), card.name])),
    )
    const produtos = [...snapshot.arts, ...snapshot.otherProducts].map((p) => ({
      productId: p.productId,
      cardCode: p.cardCode.toUpperCase(),
      label: p.label,
      groupCode: p.groupCode ?? null,
      value: p.value,
    }))
    const porId = new Map(produtos.map((p) => [p.productId, p]))
    const porCodigo = new Map<string, typeof produtos>()
    for (const p of produtos) porCodigo.set(p.cardCode, [...(porCodigo.get(p.cardCode) ?? []), p])

    const liga = new Map(loadLigaCards().map((entry) => [entry.arte, entry.url]))

    const normais = await prisma.cardVariant.findMany({
      where: { variantType: 'Normal' },
      select: { cardId: true, printings: { select: { set: { select: { code: true } } } } },
    })
    const setsDaNormal = new Map(normais.map((n) => [n.cardId, n.printings.map((p) => p.set.code)]))

    // So o automatico: o manual e julgamento do dono do produto, e nao se revisa aqui.
    const vinculadas = await prisma.cardVariant.findMany({
      where: { variantType: 'Parallel', sourceProducts: { some: { origin: 'automatic' } } },
      select: {
        cardId: true,
        sourceId: true,
        rarity: true,
        imageUrl: true,
        card: { select: { code: true, name: true } },
        printings: { select: { set: { select: { code: true } } } },
        sourceProducts: { select: { sourceProductId: true } },
      },
      orderBy: { sourceId: 'asc' },
    })

    const conflitos: LigaConflict[] = []
    for (const v of vinculadas) {
      const ligaUrl = liga.get(v.sourceId!)
      const vinculado = porId.get(v.sourceProducts[0].sourceProductId)
      if (!ligaUrl || !vinculado) continue

      const sets = v.printings.map((p) => p.set.code)
      const tratamento = ligaConflict({
        art: {
          cardCode: v.card.code,
          ligaUrl,
          rarity: v.rarity,
          cardName: v.card.name,
          parallelSets: sets,
          normalSets: setsDaNormal.get(v.cardId) ?? [],
        },
        linkedLabel: vinculado.label,
      })
      if (tratamento === null) continue

      const params = new URL(ligaUrl).searchParams
      const semCodigo = ({ productId, label, groupCode, value }: (typeof produtos)[number]) => ({
        productId,
        label,
        groupCode,
        value,
      })
      conflitos.push({
        sourceId: v.sourceId!,
        cardCode: v.card.code,
        cardName: v.card.name,
        rarity: v.rarity,
        imageUrl: v.imageUrl,
        sets,
        liga: { url: ligaUrl, nome: params.get('card') ?? '', ed: params.get('ed'), tratamento },
        vinculado: semCodigo(vinculado),
        produtos: (porCodigo.get(v.card.code.toUpperCase()) ?? []).map(semCodigo),
      })
    }

    saveLigaConflicts(conflitos)
    const valor = conflitos.reduce((total, c) => total + (c.vinculado.value ?? 0), 0)
    console.log(`[conflitos] ${conflitos.length} vinculos discordam da Liga, US$ ${valor.toFixed(0)} em preco`)
    console.log('[conflitos] escrito: liga-conflitos.json — abra /dev/liga/conflitos')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('[conflitos] falhou:', error instanceof Error ? error.message : error)
  process.exit(1)
})
