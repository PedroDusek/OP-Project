import type { PrismaClient } from '@prisma/client'

/**
 * Leitura de preço.
 *
 * Camada: application.
 *
 * O preço vigente e a **ultima linha** da serie — precos nunca sao sobrescritos
 * (`business-rules.md` 5), entao "o preco de hoje" e a captura mais recente.
 *
 * A serie e esparsa de proposito (so grava quando muda), e isso tem uma
 * consequencia que a tela precisa respeitar: `capturedAt` e a data da ultima
 * **mudanca**, nao da ultima conferida. Dizer "atualizado em" seria mentira;
 * "preco desde" e o que a linha realmente significa.
 */

export interface MarketPrice {
  value: number
  /** Quando este valor passou a valer. Nao e a data da ultima verificacao. */
  since: Date
  currency: 'USD'
}

export async function getMarketPrice(
  prisma: PrismaClient,
  cardVariantId: bigint,
): Promise<MarketPrice | null> {
  const price = await prisma.cardPrice.findFirst({
    where: { cardVariantId },
    orderBy: { capturedAt: 'desc' },
    select: { value: true, capturedAt: true },
  })
  if (!price) return null

  return { value: Number(price.value), since: price.capturedAt, currency: 'USD' }
}
