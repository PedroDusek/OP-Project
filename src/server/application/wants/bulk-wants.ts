import type { PrismaClient } from '@prisma/client'
import { ConflictError } from '@/server/domain/errors'
import type { AuthenticatedUser } from '@/server/application/auth'

/**
 * Acrescentar várias cartas à want list de uma vez.
 *
 * Camada: application.
 *
 * ## Acrescenta, não substitui
 *
 * Quem já quer duas e marca mais uma passa a querer três. É o gesto que a tela
 * atende — passar pela lista de uma coleção anotando o que falta — e o oposto
 * seria destrutivo: uma leva substituindo o número apagaria em silêncio o que a
 * pessoa já tinha anotado carta a carta.
 *
 * Reduzir continua sendo carta a carta, na revisão da lista. Uma leva que
 * também tira exigiria um controle capaz de dizer "menos que zero" e um jeito
 * de distinguir "não mexi" de "quero zero" — complexidade que não paga.
 *
 * ## Uma transação, e por que o teto existe
 *
 * O mesmo teto da leva de armazenamento, pelo mesmo motivo: acima de duzentas a
 * transação fica longa demais para uma tela esperar.
 *
 * ## Sem lock, como a escrita de um want só
 *
 * Um want não sustenta invariante entre linhas — ninguém aloca contra ele. O
 * `upsert` sobre a chave única resolve a corrida, e duas telas gravando ao mesmo
 * tempo terminam somando as duas levas, que é o esperado de "acrescentar".
 */

/** Teto por leva, igual ao do armazenamento e pelo mesmo motivo. */
export const MAX_BULK_WANTS = 200

export interface BulkWantEntry {
  cardVariantId: bigint
  /** Quantas cópias acrescentar ao que já se quer. Sempre positivo. */
  copies: number
}

export interface BulkWantResult {
  /** Variantes tocadas nesta leva. */
  variants: number
  /** Cópias acrescentadas ao todo. */
  copies: number
}

export async function bulkAddWants(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  entries: readonly BulkWantEntry[],
): Promise<BulkWantResult> {
  const merged = mergeEntries(entries)
  if (merged.length === 0) {
    throw new ConflictError('LEVA_VAZIA', 'Escolha ao menos uma carta.')
  }
  if (merged.length > MAX_BULK_WANTS) {
    throw new ConflictError(
      'LEVA_GRANDE',
      `Uma leva comporta até ${MAX_BULK_WANTS} cartas diferentes.`,
    )
  }

  const ids = merged.map((entry) => entry.cardVariantId)
  const existing = await prisma.cardVariant.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  })
  if (existing.length !== merged.length) {
    throw new ConflictError('VARIANTE_AUSENTE', 'Alguma carta da leva não existe mais.')
  }

  await prisma.$transaction(async (tx) => {
    for (const entry of merged) {
      await tx.wantItem.upsert({
        where: {
          userId_cardVariantId: { userId: user.id, cardVariantId: entry.cardVariantId },
        },
        create: { userId: user.id, cardVariantId: entry.cardVariantId, quantity: entry.copies },
        // `increment` e não um número calculado antes: a soma acontece no banco,
        // então duas levas simultâneas somam as duas em vez de uma sobrescrever
        // a outra.
        update: { quantity: { increment: entry.copies } },
      })
    }
  })

  return {
    variants: merged.length,
    copies: merged.reduce((total, entry) => total + entry.copies, 0),
  }
}

/**
 * Junta repetições e descarta o que não acrescenta nada.
 *
 * A mesma carta pode chegar duas vezes se a pessoa mexer no contador, filtrar e
 * voltar. Somar aqui evita duas escritas na mesma linha dentro da transação.
 */
function mergeEntries(entries: readonly BulkWantEntry[]): BulkWantEntry[] {
  const merged = new Map<string, BulkWantEntry>()

  for (const entry of entries) {
    if (!Number.isInteger(entry.copies) || entry.copies <= 0) continue

    const key = String(entry.cardVariantId)
    const found = merged.get(key)
    if (found) found.copies += entry.copies
    else merged.set(key, { cardVariantId: entry.cardVariantId, copies: entry.copies })
  }

  return [...merged.values()]
}
