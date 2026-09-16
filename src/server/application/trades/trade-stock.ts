import type { PrismaClient } from '@prisma/client'
import { compareCatalogOrder, placementSet, type CatalogOrderKey } from '@/server/domain/catalog/order'

/**
 * O que uma ou mais pessoas têm disponível para troca, como outros podem ver.
 *
 * Camada: application.
 *
 * Um lugar só para o Trade Binder que **outra** pessoa vê — pelo link público
 * (decisão 064) e pela rede (decisão 079). A garantia da regra 6.1 mora aqui: a
 * consulta só traz cópias em locais de finalidade `TRADE`, somadas entre eles, e
 * nada da coleção, dos outros locais, da want list, nem quantas a pessoa tem ao
 * todo.
 */

export interface VisibleTradeCard {
  variantId: string
  cardCode: string
  cardName: string
  rarity: string | null
  variantType: string
  imageUrl: string | null
  /** Cópias disponíveis para troca, somadas entre todos os locais de troca. */
  quantity: number
}

/** As cartas de troca de cada pessoa, na ordem do catálogo. Quem não tem nada fica de fora. */
export async function readVisibleTradeStock(
  prisma: PrismaClient,
  userIds: readonly bigint[],
): Promise<Map<bigint, VisibleTradeCard[]>> {
  const resultado = new Map<bigint, VisibleTradeCard[]>()
  if (userIds.length === 0) return resultado

  const rows = await prisma.collectionItemLocation.findMany({
    where: {
      quantity: { gt: 0 },
      storageLocation: { userId: { in: [...userIds] }, purpose: 'TRADE' },
    },
    select: {
      quantity: true,
      storageLocation: { select: { userId: true } },
      collectionItem: {
        select: {
          collection: { select: { userId: true } },
          cardVariant: {
            select: {
              id: true,
              sourceId: true,
              variantType: true,
              rarity: true,
              imageUrl: true,
              card: { select: { code: true, name: true } },
              printings: { select: { set: { select: { code: true } } } },
            },
          },
        },
      },
    },
  })

  const porDono = new Map<bigint, Map<string, { card: VisibleTradeCard; order: CatalogOrderKey }>>()

  for (const row of rows) {
    const dono = row.storageLocation.userId
    // A copia tem de ser da colecao de quem guarda: alocacao em local alheio
    // nao deveria existir, e se existir nao vira oferta de ninguem.
    if (row.collectionItem.collection.userId !== dono) continue

    const variante = row.collectionItem.cardVariant
    const chave = String(variante.id)
    const doDono = porDono.get(dono) ?? new Map()
    porDono.set(dono, doDono)

    // O conjunto e somado entre os locais: quem olha ve "3 copias", e nao
    // "2 no binder e 1 na caixa" (decisao 064).
    const achado = doDono.get(chave)
    if (achado) {
      achado.card.quantity += row.quantity
      continue
    }

    doDono.set(chave, {
      order: {
        cardCode: variante.card.code,
        sourceId: variante.sourceId,
        setCode: placementSet(variante.card.code, variante.printings.map((p) => p.set.code)),
      },
      card: {
        variantId: chave,
        cardCode: variante.card.code,
        cardName: variante.card.name,
        rarity: variante.rarity,
        variantType: variante.variantType,
        imageUrl: variante.imageUrl,
        quantity: row.quantity,
      },
    })
  }

  // A mesma ordem do catalogo e da colecao — lancamento, promos no fim, e o
  // codigo dentro do set (decisoes 040 e 069) —, porque e a ordem que quem joga
  // ja aprendeu.
  for (const [dono, cartas] of porDono) {
    resultado.set(
      dono,
      [...cartas.values()]
        .sort((a, b) => compareCatalogOrder(a.order, b.order) || (a.card.variantId < b.card.variantId ? -1 : 1))
        .map((entrada) => entrada.card),
    )
  }
  return resultado
}
