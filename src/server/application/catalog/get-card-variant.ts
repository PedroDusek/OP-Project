import type { PrismaClient } from '@prisma/client'
import { ligaCardLink } from '@/server/domain/catalog/liga'
import { tcgplayerProductUrl } from '@/server/domain/prices/tcgplayer-link'
import { NotFoundError } from '@/server/domain/errors'

/**
 * Detalhe de uma variante.
 *
 * Camada: application. Traz o que a tela da carta precisa numa consulta so:
 * dados da carta, vocabulario, as demais artes da mesma carta e os sets.
 * Sem isso a pagina faria uma consulta por bloco, que e o N+1 classico.
 *
 * O link da Liga sai daqui, e nao do componente, porque depende da tabela
 * conferida (decisao 071), que mora num arquivo — e a tela nao fala com
 * infraestrutura. A tabela chega por parametro, para o teste passar a sua.
 *
 * O do TCGplayer sai do vinculo da arte com a fonte de preco: o produto dela e o
 * produto do TCGplayer (`domain/prices/tcgplayer-link.ts`).
 */
export async function getCardVariant(
  prisma: PrismaClient,
  variantId: bigint,
  ligaCards: ReadonlyMap<string, string | null> = new Map(),
) {
  const variant = await prisma.cardVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      sourceId: true,
      variantType: true,
      rarity: true,
      imageUrl: true,
      printings: { select: { set: { select: { code: true, name: true } } } },
      // So existe uma fonte de preco; o primeiro vinculo e o dela.
      sourceProducts: { select: { sourceProductId: true }, take: 1 },
      card: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          cost: true,
          power: true,
          life: true,
          counter: true,
          hasTrigger: true,
          blockIcon: true,
          colors: { select: { color: { select: { name: true } } } },
          traits: { select: { trait: { select: { name: true } } } },
          attributes: { select: { attribute: { select: { name: true } } } },
          mechanics: { select: { mechanic: { select: { name: true } } } },
          effects: { select: { effect: { select: { name: true } } } },
          variants: {
            select: {
              id: true,
              variantType: true,
              rarity: true,
              imageUrl: true,
            },
            orderBy: { id: 'asc' },
          },
        },
      },
    },
  })

  if (!variant) throw new NotFoundError('Variante nao encontrada.')

  const { card } = variant
  return {
    variantId: variant.id,
    variantType: variant.variantType,
    rarity: variant.rarity,
    imageUrl: variant.imageUrl,
    sets: variant.printings.map((p) => p.set),
    liga: ligaCardLink({
      cardCode: card.code,
      cardName: card.name,
      variantType: variant.variantType,
      verified: variant.sourceId === null ? undefined : ligaCards.get(variant.sourceId),
    }),
    tcgplayerUrl: tcgplayerProductUrl(variant.sourceProducts[0]?.sourceProductId),
    card: {
      code: card.code,
      name: card.name,
      type: card.type,
      cost: card.cost,
      power: card.power,
      life: card.life,
      counter: card.counter,
      hasTrigger: card.hasTrigger,
      blockIcon: card.blockIcon,
      colors: card.colors.map((c) => c.color.name),
      traits: card.traits.map((t) => t.trait.name),
      attributes: card.attributes.map((a) => a.attribute.name),
      mechanics: card.mechanics.map((m) => m.mechanic.name),
      effects: card.effects.map((e) => e.effect.name),
    },
    /** Todas as artes desta carta, incluindo a atual. */
    siblings: card.variants.map((v) => ({
      variantId: v.id,
      variantType: v.variantType,
      rarity: v.rarity,
      imageUrl: v.imageUrl,
      current: v.id === variant.id,
    })),
  }
}
