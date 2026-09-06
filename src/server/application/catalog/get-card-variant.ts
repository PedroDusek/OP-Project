import type { PrismaClient } from '@prisma/client'
import { NotFoundError } from '@/server/domain/errors'

/**
 * Detalhe de uma variante.
 *
 * Camada: application. Traz o que a tela da carta precisa numa consulta so:
 * dados da carta, vocabulario, as demais artes da mesma carta e os sets.
 * Sem isso a pagina faria uma consulta por bloco, que e o N+1 classico.
 */
export async function getCardVariant(prisma: PrismaClient, variantId: bigint) {
  const variant = await prisma.cardVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      variantType: true,
      rarity: true,
      imageUrl: true,
      printings: { select: { set: { select: { code: true, name: true } } } },
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
