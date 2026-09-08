import type { PrismaClient } from '@prisma/client'
import { ConflictError, NotFoundError } from '@/server/domain/errors'
import type { AuthenticatedUser } from '@/server/application/auth'

/**
 * Mover cópias de um local para outro.
 *
 * Camada: application.
 *
 * ## Por que é uma operação, e não duas
 *
 * Retirar de um binder e guardar em outro são duas escritas que precisam
 * acontecer juntas. Em duas chamadas existiria um instante em que as cópias não
 * estão em lugar nenhum — e um erro no meio pararia exatamente ali, deixando a
 * pessoa com a carta "sumida" do binder de origem e ausente do destino.
 *
 * ## A ordem dentro da transação importa
 *
 * Tira primeiro, põe depois. O trigger `collection_item_locations_within_owned_quantity`
 * roda **por linha, depois de gravar**, então acrescentar antes de retirar faria
 * a soma passar do possuído por um instante — e o trigger recusaria uma
 * movimentação que, no fim, não muda soma nenhuma.
 *
 * ## O lock é o mesmo
 *
 * A linha de `collection_items` é travada como em toda escrita de alocação. Sem
 * isso, mover enquanto alguém reduz a quantidade possuída poderia deixar o
 * destino acima do que se tem.
 */

export const NOT_ENOUGH_HERE = 'COPIAS_INSUFICIENTES_NO_LOCAL'

export interface MoveResult {
  copies: number
  /** `true` quando a origem ficou sem nenhuma cópia desta carta. */
  emptiedOrigin: boolean
}

export async function moveAllocation(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  cardVariantId: bigint,
  fromStorageLocationId: bigint,
  toStorageLocationId: bigint,
  copies: number,
): Promise<MoveResult> {
  if (!Number.isInteger(copies) || copies <= 0) {
    throw new ConflictError('QUANTIDADE_INVALIDA', 'Escolha ao menos uma cópia para mover.')
  }
  if (fromStorageLocationId === toStorageLocationId) {
    throw new ConflictError('MESMO_LOCAL', 'Escolha um local diferente do atual.')
  }

  return prisma.$transaction(async (tx) => {
    // Os dois locais são buscados pelo dono: um id de outra pessoa não existe
    // daqui (`architecture.md` 3.5).
    const locations = await tx.storageLocation.findMany({
      where: { id: { in: [fromStorageLocationId, toStorageLocationId] }, userId: user.id },
      select: { id: true },
    })
    if (locations.length !== 2) throw new NotFoundError('Local não encontrado.')

    const item = await tx.collectionItem.findFirst({
      where: { cardVariantId, collection: { userId: user.id } },
      select: { id: true },
    })
    if (!item) throw new NotFoundError('Você não tem esta carta na coleção.')

    await tx.$queryRaw`SELECT quantity FROM collection_items WHERE id = ${item.id} FOR UPDATE`

    const current = await tx.collectionItemLocation.findMany({
      where: { collectionItemId: item.id, storageLocationId: { in: [fromStorageLocationId, toStorageLocationId] } },
      select: { storageLocationId: true, quantity: true },
    })

    const here = current.find((row) => row.storageLocationId === fromStorageLocationId)?.quantity ?? 0
    if (copies > here) {
      throw new ConflictError(
        NOT_ENOUGH_HERE,
        here === 0
          ? 'Esta carta não está mais neste local.'
          : `Só há ${here} ${here === 1 ? 'cópia' : 'cópias'} aqui para mover.`,
        { available: here },
      )
    }

    const remaining = here - copies
    const key = (storageLocationId: bigint) => ({
      collectionItemId_storageLocationId: { collectionItemId: item.id, storageLocationId },
    })

    // Tira primeiro: a soma nunca passa do possuído em nenhum passo.
    if (remaining === 0) {
      await tx.collectionItemLocation.delete({ where: key(fromStorageLocationId) })
    } else {
      await tx.collectionItemLocation.update({
        where: key(fromStorageLocationId),
        data: { quantity: remaining },
      })
    }

    const there = current.find((row) => row.storageLocationId === toStorageLocationId)?.quantity ?? 0
    await tx.collectionItemLocation.upsert({
      where: key(toStorageLocationId),
      create: {
        collectionItemId: item.id,
        storageLocationId: toStorageLocationId,
        quantity: copies,
      },
      update: { quantity: there + copies },
    })

    return { copies, emptiedOrigin: remaining === 0 }
  })
}
