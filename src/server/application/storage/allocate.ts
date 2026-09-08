import type { PrismaClient } from '@prisma/client'
import { ConflictError, NotFoundError } from '@/server/domain/errors'
import { roomFor, unallocatedCopies, type Allocation } from '@/server/domain/storage/allocation'
import { describeLocation, type StoragePurpose, type StorageType } from '@/server/domain/storage/locations'
import type { AuthenticatedUser } from '@/server/application/auth'

/**
 * Guardar cópias de uma carta num local.
 *
 * Camada: application.
 *
 * ## O lock é o mesmo da quantidade, e é de propósito
 *
 * A invariante `SUM(alocado) <= possuído` é entre linhas: nenhuma checagem de
 * uma linha só a enxerga. Duas alocações simultâneas da mesma carta em dois
 * locais leriam a mesma soma e as duas passariam, cada uma certa sozinha e as
 * duas erradas juntas.
 *
 * O item da coleção é travado com `SELECT ... FOR UPDATE` — a **mesma** linha
 * que `setCollectionQuantity` trava. Sendo a mesma, alocar e reduzir a
 * quantidade também se serializam entre si, que é o caso realmente traiçoeiro:
 * reduzir para 2 enquanto se aloca a terceira cópia.
 *
 * O banco tem três triggers cobrindo isso como rede de segurança. Elas existem
 * para o caso de alguém escrever por outro caminho; a mensagem legível de quem
 * usa a tela é montada aqui.
 */

export const ALLOCATION_EXCEEDS_OWNED = 'ALOCACAO_ACIMA_DO_POSSUIDO'

export interface AllocationView {
  storageLocationId: string
  name: string
  type: StorageType
  purpose: StoragePurpose | null
  /** A foto do local, para a lista mostrar o mesmo quadro do resto do produto. */
  image: string | null
  subtitle: string
  /** Cópias desta variante guardadas ali. Zero quando não há. */
  quantity: number
}

export interface VariantAllocations {
  ownedQuantity: number
  allocated: number
  /** Cópias que a pessoa tem sem lugar registrado. */
  unallocated: number
  locations: AllocationView[]
}

/**
 * Onde estão as cópias de uma variante — e onde poderiam estar.
 *
 * Devolve **todos** os locais da pessoa, inclusive os vazios, porque a tela é
 * de escolha: uma lista só com o que já foi guardado não deixa guardar em lugar
 * novo.
 */
export async function listVariantAllocations(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  cardVariantId: bigint,
): Promise<VariantAllocations> {
  const [locations, item] = await Promise.all([
    prisma.storageLocation.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, type: true, purpose: true, image: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
    prisma.collectionItem.findFirst({
      where: { cardVariantId, collection: { userId: user.id } },
      select: { quantity: true, locations: { select: { storageLocationId: true, quantity: true } } },
    }),
  ])

  const here = new Map((item?.locations ?? []).map((row) => [String(row.storageLocationId), row.quantity]))
  const allocations: Allocation[] = [...here].map(([storageLocationId, quantity]) => ({
    storageLocationId,
    quantity,
  }))
  const ownedQuantity = item?.quantity ?? 0

  return {
    ownedQuantity,
    allocated: allocations.reduce((sum, allocation) => sum + allocation.quantity, 0),
    unallocated: unallocatedCopies(ownedQuantity, allocations),
    locations: locations.map((location) => {
      const type = location.type as StorageType
      const purpose = location.purpose as StoragePurpose | null
      return {
        storageLocationId: String(location.id),
        name: location.name,
        type,
        purpose,
        image: location.image,
        subtitle: describeLocation(type, purpose),
        quantity: here.get(String(location.id)) ?? 0,
      }
    }),
  }
}

export interface SetAllocationResult {
  quantity: number
  /** `true` quando a carta deixou de estar naquele local. */
  removed: boolean
}

export async function setAllocation(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  cardVariantId: bigint,
  storageLocationId: bigint,
  quantity: number,
): Promise<SetAllocationResult> {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new ConflictError('QUANTIDADE_INVALIDA', 'A quantidade precisa ser zero ou mais.')
  }

  return writeAllocation(prisma, user, cardVariantId, storageLocationId, () => quantity)
}

/**
 * Acrescenta cópias a um local, em vez de definir o total.
 *
 * Existe para a tela de organizar: lá a pergunta é "guardar 3 aqui", e quem
 * pergunta não sabe — nem deveria precisar saber — quantas já estavam no local.
 * Calcular o total no cliente seria calcular a partir de um número lido antes,
 * que é exatamente a leitura que o lock existe para invalidar.
 */
export async function addAllocation(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  cardVariantId: bigint,
  storageLocationId: bigint,
  copies: number,
): Promise<SetAllocationResult> {
  if (!Number.isInteger(copies) || copies <= 0) {
    throw new ConflictError('QUANTIDADE_INVALIDA', 'Escolha ao menos uma cópia.')
  }

  return writeAllocation(prisma, user, cardVariantId, storageLocationId, (current) => current + copies)
}

/**
 * O corpo compartilhado: trava, confere o espaço e grava.
 *
 * `resolve` recebe o que já está **neste** local, lido dentro da transação, e
 * devolve o total desejado. É o que permite "definir" e "acrescentar" sem duas
 * cópias da mesma verificação — e sem que "acrescentar" dependa de um número
 * lido antes do lock.
 */
async function writeAllocation(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  cardVariantId: bigint,
  storageLocationId: bigint,
  resolve: (currentHere: number) => number,
): Promise<SetAllocationResult> {
  return prisma.$transaction(async (tx) => {
    const location = await tx.storageLocation.findFirst({
      where: { id: storageLocationId, userId: user.id },
      select: { id: true },
    })
    if (!location) throw new NotFoundError('Local não encontrado.')

    const item = await tx.collectionItem.findFirst({
      where: { cardVariantId, collection: { userId: user.id } },
      select: { id: true },
    })
    if (!item) throw new NotFoundError('Você ainda não tem esta carta na coleção.')

    const locked = await tx.$queryRaw<{ quantity: number }[]>`
      SELECT quantity FROM collection_items WHERE id = ${item.id} FOR UPDATE
    `
    const owned = locked[0]?.quantity ?? 0

    const existing = await tx.collectionItemLocation.findMany({
      where: { collectionItemId: item.id },
      select: { storageLocationId: true, quantity: true },
    })
    const allocations: Allocation[] = existing.map((row) => ({
      storageLocationId: String(row.storageLocationId),
      quantity: row.quantity,
    }))

    const current = existing.find((row) => row.storageLocationId === location.id)
    const quantity = resolve(current?.quantity ?? 0)

    const room = roomFor(owned, allocations, String(location.id))
    if (quantity > room) {
      throw new ConflictError(
        ALLOCATION_EXCEEDS_OWNED,
        room === 0
          ? 'Todas as suas cópias já estão guardadas em outros locais.'
          : `Você pode guardar no máximo ${room} aqui: as outras cópias estão em outros locais.`,
        { ownedQuantity: owned, room },
      )
    }

    if (quantity === 0) {
      if (current) {
        await tx.collectionItemLocation.delete({
          where: {
            collectionItemId_storageLocationId: {
              collectionItemId: item.id,
              storageLocationId: location.id,
            },
          },
        })
      }
      return { quantity: 0, removed: true }
    }

    await tx.collectionItemLocation.upsert({
      where: {
        collectionItemId_storageLocationId: {
          collectionItemId: item.id,
          storageLocationId: location.id,
        },
      },
      create: { collectionItemId: item.id, storageLocationId: location.id, quantity },
      update: { quantity },
    })

    return { quantity, removed: false }
  })
}
