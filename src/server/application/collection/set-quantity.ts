import type { PrismaClient } from '@prisma/client'
import { ConflictError, NotFoundError } from '@/server/domain/errors'
import type { AuthenticatedUser } from '@/server/application/auth'

/**
 * Definir quantas copias de uma variante a pessoa possui.
 *
 * Camada: application. E aqui que a decisao 007 vira codigo.
 *
 * ## O conflito
 *
 * Reduzir a quantidade abaixo do que ja esta alocado em armazenamento **nao**
 * desaloca sozinho e **nao** devolve erro seco. A escrita e recusada inteira e
 * o conflito volta carregando as alocacoes atuais, para a interface montar a
 * tela onde a pessoa escolhe de quais locais as copias saem.
 *
 * Nenhuma alocacao some sem alguem ver, e nenhuma ordem de remocao e presumida.
 *
 * ## O lock
 *
 * Duas edicoes simultaneas da mesma linha poderiam ler o mesmo estado e gravar
 * por cima uma da outra — a segunda apagaria a primeira, e a soma das alocacoes
 * poderia passar da quantidade possuida sem nenhuma delas ter errado sozinha.
 *
 * `SELECT ... FOR UPDATE` dentro da transacao serializa as duas. A insercao
 * usa `ON CONFLICT DO NOTHING` antes do lock porque nao ha linha para travar
 * quando ela ainda nao existe: quem perder a corrida da insercao encontra a
 * linha do outro e espera por ela.
 */

export interface AllocationSnapshot {
  storageLocationId: string
  storageName: string
  quantity: number
}

export const QUANTITY_BELOW_ALLOCATED = 'QUANTIDADE_ABAIXO_DO_ALOCADO'

export interface SetQuantityResult {
  quantity: number
  /** `true` quando a variante saiu da colecao. */
  removed: boolean
}

export async function setCollectionQuantity(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  cardVariantId: bigint,
  quantity: number,
): Promise<SetQuantityResult> {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new ConflictError('QUANTIDADE_INVALIDA', 'A quantidade precisa ser zero ou mais.')
  }

  return prisma.$transaction(async (tx) => {
    /*
     * A colecao e buscada pelo dono, e nao pelo id que veio de fora
     * (`architecture.md` 3.5): escopar a consulta e o que impede escrever na
     * colecao de outra pessoa, sem depender de uma verificacao posterior.
     */
    const collection = await tx.collection.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!collection) throw new NotFoundError('Colecao nao encontrada.')

    const variant = await tx.cardVariant.findUnique({
      where: { id: cardVariantId },
      select: { id: true },
    })
    if (!variant) throw new NotFoundError('Variante nao encontrada.')

    if (quantity > 0) {
      // Cria a linha se ela ainda nao existe. Quem perder a corrida cai no
      // caminho de atualizacao abaixo e espera pelo lock do vencedor.
      const inserted = await tx.$executeRaw`
        INSERT INTO collection_items (collection_id, card_variant_id, quantity)
        VALUES (${collection.id}, ${cardVariantId}, ${quantity})
        ON CONFLICT (collection_id, card_variant_id) DO NOTHING
      `
      if (inserted === 1) return { quantity, removed: false }
    }

    const locked = await tx.$queryRaw<{ id: bigint; quantity: number }[]>`
      SELECT id, quantity FROM collection_items
      WHERE collection_id = ${collection.id} AND card_variant_id = ${cardVariantId}
      FOR UPDATE
    `
    const item = locked[0]

    // Zerar o que ja nao existe nao e erro: o estado pedido e o estado atual.
    if (!item) return { quantity: 0, removed: true }

    const allocated = await tx.collectionItemLocation.findMany({
      where: { collectionItemId: item.id },
      select: {
        quantity: true,
        storageLocation: { select: { id: true, name: true } },
      },
      orderBy: { storageLocationId: 'asc' },
    })

    const totalAllocated = allocated.reduce((sum, row) => sum + row.quantity, 0)

    if (quantity < totalAllocated) {
      throw new ConflictError(
        QUANTITY_BELOW_ALLOCATED,
        `Você tem ${totalAllocated} cópias guardadas em locais de armazenamento. ` +
          `Escolha de onde retirar antes de reduzir para ${quantity}.`,
        {
          requestedQuantity: quantity,
          currentQuantity: item.quantity,
          totalAllocated,
          allocations: allocated.map(
            (row): AllocationSnapshot => ({
              storageLocationId: String(row.storageLocation.id),
              storageName: row.storageLocation.name,
              quantity: row.quantity,
            }),
          ),
        },
      )
    }

    if (quantity === 0) {
      await tx.collectionItem.delete({ where: { id: item.id } })
      return { quantity: 0, removed: true }
    }

    await tx.collectionItem.update({ where: { id: item.id }, data: { quantity } })
    return { quantity, removed: false }
  })
}
