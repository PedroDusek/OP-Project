import type { PrismaClient } from '@prisma/client'
import { DON_TYPE } from '@/server/domain/catalog/types'
import { SEALED_LEADER_PRODUCT_IDS } from '@/server/domain/catalog/lider-selado'

/**
 * Liga ao produto do TCGplayer as cartas cujo `source_id` **é** o `productId`:
 * os DON!! (decisão 112) e os líderes de evento selado (decisão 115).
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
  /*
   * Duas familias, e o mesmo motivo (decisao 115).
   *
   * Os DON!! entram pelo **tipo**. Os lideres de evento selado nao podem:
   * eles sao `Leader`, como 149 cartas da Bandai cujo `source_id` e
   * `OP01-003`, e casar por tipo mandaria todas elas para ca — cada uma
   * ganharia um vinculo com um "productId" que e o codigo da carta.
   *
   * Entao eles entram pela **lista de ids escolhidos**, que e a mesma que a
   * importacao usa. E a lista curta e explicita, em vez de uma regra que
   * tentasse reconhecer "source_id numerico".
   */
  const variants = await prisma.cardVariant.findMany({
    where: {
      sourceId: { not: null },
      OR: [
        { card: { type: DON_TYPE } },
        { sourceId: { in: SEALED_LEADER_PRODUCT_IDS.map(String) } },
      ],
    },
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
