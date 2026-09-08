import type { PrismaClient } from '@prisma/client'
import { compareSetsForCatalog } from '@/server/domain/catalog/sets'
import { unallocatedCopies, type Allocation } from '@/server/domain/storage/allocation'
import type { AuthenticatedUser } from '@/server/application/auth'

/**
 * As cópias que a pessoa tem e não registrou em lugar nenhum.
 *
 * Camada: application.
 *
 * Não existe local "sem lugar" (`business-rules.md` 3.2), e nada aqui inventa
 * um: isto é o **resto da conta** — possuído menos alocado —, calculado na
 * leitura. Materializar isso numa tabela criaria um segundo lugar capaz de
 * divergir da soma real.
 *
 * Cópia sem lugar é estado normal e não é erro. O que ela justifica é um
 * lembrete discreto, não um aviso de problema.
 */

export interface UnallocatedSummary {
  /** Cópias soltas, somadas. */
  copies: number
  /** Variantes distintas com pelo menos uma cópia solta. */
  cards: number
}

export interface UnallocatedCard {
  variantId: string
  cardCode: string
  cardName: string
  rarity: string | null
  variantType: string
  imageUrl: string | null
  owned: number
  allocated: number
  /** Cópias desta variante ainda sem lugar. */
  loose: number
}

/** Itens da coleção com as alocações de cada um, na forma do domínio. */
async function ownedWithAllocations(prisma: PrismaClient, user: AuthenticatedUser) {
  return prisma.collectionItem.findMany({
    where: { collection: { userId: user.id }, quantity: { gt: 0 } },
    select: {
      quantity: true,
      locations: { select: { storageLocationId: true, quantity: true } },
      cardVariant: {
        select: {
          id: true,
          variantType: true,
          rarity: true,
          imageUrl: true,
          card: { select: { code: true, name: true } },
          printings: { select: { set: { select: { code: true } } }, take: 1 },
        },
      },
    },
  })
}

const toAllocations = (rows: { storageLocationId: bigint; quantity: number }[]): Allocation[] =>
  rows.map((row) => ({ storageLocationId: String(row.storageLocationId), quantity: row.quantity }))

/**
 * Os dois números do lembrete.
 *
 * Cópias **e** cartas porque respondem a perguntas diferentes: "faltam guardar
 * 12 cópias" diz o tamanho do trabalho, "de 5 cartas" diz quantas vezes a
 * pessoa vai tocar na tela.
 */
export async function countUnallocated(
  prisma: PrismaClient,
  user: AuthenticatedUser,
): Promise<UnallocatedSummary> {
  const items = await prisma.collectionItem.findMany({
    where: { collection: { userId: user.id }, quantity: { gt: 0 } },
    select: { quantity: true, locations: { select: { storageLocationId: true, quantity: true } } },
  })

  let copies = 0
  let cards = 0
  for (const item of items) {
    const loose = unallocatedCopies(item.quantity, toAllocations(item.locations))
    if (loose > 0) {
      copies += loose
      cards += 1
    }
  }

  return { copies, cards }
}

/**
 * A lista de quem está solto, na ordem do catálogo.
 *
 * A mesma ordem de lançamento das outras telas (decisão 040): quem organiza
 * uma coleção percorre por set, e uma ordem diferente aqui obrigaria a
 * reaprender a lista.
 */
export async function listUnallocated(
  prisma: PrismaClient,
  user: AuthenticatedUser,
): Promise<UnallocatedCard[]> {
  const items = await ownedWithAllocations(prisma, user)

  const loose = items
    .map((item) => {
      const allocations = toAllocations(item.locations)
      const allocated = allocations.reduce((sum, a) => sum + a.quantity, 0)
      const variant = item.cardVariant

      return {
        card: {
          variantId: String(variant.id),
          cardCode: variant.card.code,
          cardName: variant.card.name,
          rarity: variant.rarity,
          variantType: variant.variantType,
          imageUrl: variant.imageUrl,
          owned: item.quantity,
          allocated,
          loose: unallocatedCopies(item.quantity, allocations),
        } satisfies UnallocatedCard,
        setCode: variant.printings[0]?.set.code ?? null,
      }
    })
    .filter((row) => row.card.loose > 0)

  loose.sort((a, b) => {
    const set = compareSetsForCatalog(a.setCode, b.setCode)
    if (set !== 0) return set
    if (a.card.cardCode !== b.card.cardCode) return a.card.cardCode < b.card.cardCode ? -1 : 1
    return a.card.variantId < b.card.variantId ? -1 : a.card.variantId > b.card.variantId ? 1 : 0
  })

  return loose.map((row) => row.card)
}
