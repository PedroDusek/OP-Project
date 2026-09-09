import type { PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { compareSetsForCatalog } from '@/server/domain/catalog/sets'

/**
 * O Trade Binder: o que esta pessoa tem disponível para troca.
 *
 * Camada: application.
 *
 * ## O que conta como disponível
 *
 * Só o que está em armazenamento com finalidade `TRADE` (`business-rules.md`
 * 4.1). Cópias em armazenamento de coleção e em decks continuam integralmente
 * na coleção e **não** aparecem aqui — estar guardado não é estar à disposição.
 *
 * A consulta filtra por `purpose = 'TRADE'`, e não pelo tipo: deck não pode ter
 * finalidade, é `CHECK` no banco. A regra de verdade é `holdsTradeStock` no
 * domínio, e existe teste garantindo que deck nunca aparece — se aquele `CHECK`
 * afrouxar um dia, ele quebra antes de um deck virar oferta.
 *
 * ## Somado entre locais, e dizendo em quantos
 *
 * As mesmas cópias podem estar em mais de um binder de troca. A soma é o que
 * importa para oferecer; **em quantos locais** importa na hora de concluir o
 * trade, quando a regra 4.6 pergunta de onde tirar — e só pergunta quando há
 * mais de um. Trazer o número aqui evita a segunda consulta depois.
 *
 * ## Isto não é reserva
 *
 * Estar aqui significa disponível, não comprometido com ninguém
 * (`business-rules.md` 4.2). A tela diz isso em voz alta, porque "Trade Binder"
 * sugere um lugar onde as cartas ficam separadas, e não é.
 */

export interface TradeBinderCard {
  variantId: string
  cardCode: string
  cardName: string
  rarity: string | null
  variantType: string
  imageUrl: string | null
  /** Cópias disponíveis para troca, somadas entre os locais de troca. */
  quantity: number
  /** Quantos locais de troca guardam esta carta. Importa na regra 4.6. */
  locationCount: number
  /** Quantas a pessoa tem no total, para a tela mostrar o que ficou de fora. */
  ownedQuantity: number
}

export async function listTradeBinder(
  prisma: PrismaClient,
  user: AuthenticatedUser,
): Promise<TradeBinderCard[]> {
  const rows = await prisma.collectionItemLocation.findMany({
    where: { storageLocation: { userId: user.id, purpose: 'TRADE' } },
    select: {
      quantity: true,
      collectionItem: {
        select: {
          quantity: true,
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
      },
    },
  })

  const byVariant = new Map<string, { card: TradeBinderCard; setCode: string | null }>()

  for (const row of rows) {
    const variant = row.collectionItem.cardVariant
    const key = String(variant.id)
    const found = byVariant.get(key)

    if (found) {
      found.card.quantity += row.quantity
      found.card.locationCount += 1
      continue
    }

    byVariant.set(key, {
      setCode: variant.printings[0]?.set.code ?? null,
      card: {
        variantId: key,
        cardCode: variant.card.code,
        cardName: variant.card.name,
        rarity: variant.rarity,
        variantType: variant.variantType,
        imageUrl: variant.imageUrl,
        quantity: row.quantity,
        locationCount: 1,
        ownedQuantity: row.collectionItem.quantity,
      },
    })
  }

  // A mesma ordem do catálogo e da coleção — lançamento, promos no fim
  // (decisão 040) —, porque é a ordem que a pessoa já aprendeu nas outras telas.
  return [...byVariant.values()]
    .sort((a, b) => {
      const set = compareSetsForCatalog(a.setCode, b.setCode)
      if (set !== 0) return set
      if (a.card.cardCode !== b.card.cardCode) return a.card.cardCode < b.card.cardCode ? -1 : 1
      return a.card.variantId < b.card.variantId ? -1 : 1
    })
    .map((entry) => entry.card)
}

/**
 * Quantas cópias estão disponíveis para troca, ao todo.
 *
 * Duas contas diferentes e as duas úteis: a tela mostra quantas **cartas**
 * distintas há (o tamanho da lista) e quantas **cópias** elas somam. Quem
 * oferece uma troca pensa em cópias; quem procura uma carta pensa em cartas.
 */
export function countCopies(cards: readonly TradeBinderCard[]): number {
  return cards.reduce((total, card) => total + card.quantity, 0)
}
