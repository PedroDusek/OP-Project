import type { PrismaClient } from '@prisma/client'
import { ConflictError, NotFoundError } from '@/server/domain/errors'
import type { AuthenticatedUser } from '@/server/application/auth'

/**
 * Definir quantas cópias de uma variante a pessoa quer.
 *
 * Camada: application.
 *
 * ## Por que aqui não há lock
 *
 * A quantidade de um item da coleção precisa de `SELECT ... FOR UPDATE` porque
 * é a ponta de uma invariante entre linhas: a soma das alocações não pode
 * passar dela. Um want não sustenta invariante nenhuma — ninguém aloca contra
 * ele, e nada é derivado dele além de sugestão de match, que se recalcula a
 * cada leitura.
 *
 * Então a escrita é um `upsert` sobre a chave única (usuário, variante), e o
 * banco resolve a corrida: duas telas gravando ao mesmo tempo terminam com o
 * último valor, que é o comportamento esperado de um campo de preferência.
 *
 * ## Querer zero é não querer
 *
 * O banco exige `quantity > 0`, então querer zero é não ter a linha. "Tirar da
 * want list" e "definir para 0" são a mesma escrita, e por isso não existe uma
 * segunda ação capaz de divergir da primeira — o mesmo arranjo da quantidade
 * possuída.
 */

export interface SetWantResult {
  quantity: number
  /** `true` quando a variante saiu da want list. */
  removed: boolean
}

export async function setWantQuantity(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  cardVariantId: bigint,
  quantity: number,
): Promise<SetWantResult> {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new ConflictError('QUANTIDADE_INVALIDA', 'A quantidade precisa ser zero ou mais.')
  }

  const variant = await prisma.cardVariant.findUnique({
    where: { id: cardVariantId },
    select: { id: true },
  })
  if (!variant) throw new NotFoundError('Variante não encontrada.')

  if (quantity === 0) {
    // `deleteMany` e não `delete`: querer zero o que já não está na lista é o
    // estado pedido, e não um erro.
    await prisma.wantItem.deleteMany({ where: { userId: user.id, cardVariantId } })
    return { quantity: 0, removed: true }
  }

  await prisma.wantItem.upsert({
    where: { userId_cardVariantId: { userId: user.id, cardVariantId } },
    create: { userId: user.id, cardVariantId, quantity },
    update: { quantity },
  })

  return { quantity, removed: false }
}
