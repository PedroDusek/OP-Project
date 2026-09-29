import type { PrismaClient } from '@prisma/client'
import { DON_TYPE } from '@/server/domain/catalog/types'

/**
 * Liga cada DON!! ao seu produto no TCGplayer (decisão 112).
 *
 * Camada: application.
 *
 * ## Por que não passa pelo vínculo normal
 *
 * `linkArtProducts` casa arte com produto **pelo código da carta** — e foi
 * escrito assim porque, nas cartas da Bandai, o código é o único elo entre duas
 * fontes que não conversam. Para DON!! isso não funciona: eles não têm código
 * na origem, e o nosso é inventado.
 *
 * Aqui não há o que deduzir. O `source_id` da arte **é** o `productId`, porque
 * foi de lá que a carta veio. O vínculo é uma cópia, não um palpite — e por
 * isso ele nasce junto da importação, em vez de esperar a rodada de preços
 * tentar adivinhar.
 *
 * ## `origin = 'automatic'`
 *
 * Não é `manual`: ninguém conferiu nada à mão. E `manual` tem significado
 * próprio no vínculo normal — ele é intocável pela dedução (regra da decisão
 * 074), e marcar estes assim os protegeria de uma correção futura sem que
 * ninguém tivesse decidido isso.
 */
export interface LinkDonProductsResult {
  variants: number
  created: number
  updated: number
}

/** A fonte de preço, a mesma que a importação diária usa. */
const SOURCE = 'tcgcsv'

export async function linkDonProducts(prisma: PrismaClient): Promise<LinkDonProductsResult> {
  const variants = await prisma.cardVariant.findMany({
    where: { card: { type: DON_TYPE }, sourceId: { not: null } },
    select: { id: true, sourceId: true },
  })

  const result: LinkDonProductsResult = { variants: variants.length, created: 0, updated: 0 }

  for (const variant of variants) {
    const existente = await prisma.variantSourceProduct.findFirst({
      where: { cardVariantId: variant.id, source: SOURCE },
      select: { id: true, sourceProductId: true },
    })

    if (existente?.sourceProductId === variant.sourceId) continue

    if (existente) {
      await prisma.variantSourceProduct.update({
        where: { id: existente.id },
        data: { sourceProductId: variant.sourceId!, origin: 'automatic', confirmedAt: new Date() },
      })
      result.updated += 1
      continue
    }

    await prisma.variantSourceProduct.create({
      data: {
        cardVariantId: variant.id,
        source: SOURCE,
        sourceProductId: variant.sourceId!,
        origin: 'automatic',
      },
    })
    result.created += 1
  }

  return result
}
