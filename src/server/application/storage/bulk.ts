import { Prisma, type PrismaClient } from '@prisma/client'
import { NotFoundError, ValidationError } from '@/server/domain/errors'
import type { AuthenticatedUser } from '@/server/application/auth'

/**
 * Acrescentar várias cartas de uma vez a um local (telas 25 a 28).
 *
 * Camada: application.
 *
 * ## O que a operação faz
 *
 * Aumenta a quantidade possuída **e** guarda as cópias no local, numa
 * transação só. É o que a tela 28 descreve: "esta operação será aplicada na sua
 * coleção", com o local de armazenamento logo acima.
 *
 * Faz sentido porque é o gesto que ela atende: abrir pacotes e pôr as cartas no
 * binder. Só alocar não funcionaria — alocar exige possuir, e quem acabou de
 * abrir o pacote ainda não registrou nada. Guardar cópias que já se tem é outra
 * tela, `/binders/sem-lugar`, que não mexe na quantidade.
 *
 * ## Tudo ou nada
 *
 * A confirmação diz "adicionar 12 cartas". Aplicar oito e falhar em quatro seria
 * pior que falhar inteiro: a pessoa não saberia quais entraram sem conferir uma
 * a uma. Uma transação cobre a leva inteira.
 *
 * ## Por que a ordem é possuir antes de guardar
 *
 * O trigger que limita a alocação ao possuído roda por linha, depois de gravar.
 * Guardar antes de aumentar a quantidade faria a soma passar do possuído por um
 * instante, e o trigger recusaria uma operação que no fim é válida.
 */

/** Teto por leva. Acima disso a transação fica longa demais para uma tela. */
export const MAX_BULK_ENTRIES = 200

export interface BulkEntry {
  cardVariantId: bigint
  copies: number
}

export interface BulkAddResult {
  /** Variantes distintas tocadas. */
  cards: number
  /** Cópias acrescentadas, somadas. */
  copies: number
}

export async function bulkAddToLocation(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  storageLocationId: bigint,
  entries: readonly BulkEntry[],
): Promise<BulkAddResult> {
  const valid = normalize(entries)

  return prisma.$transaction(async (tx) => {
    const location = await tx.storageLocation.findFirst({
      where: { id: storageLocationId, userId: user.id },
      select: { id: true },
    })
    if (!location) throw new NotFoundError('Local não encontrado.')

    const collection = await tx.collection.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!collection) throw new NotFoundError('Coleção não encontrada.')

    const known = await tx.cardVariant.findMany({
      where: { id: { in: valid.map((entry) => entry.cardVariantId) } },
      select: { id: true },
    })
    if (known.length !== valid.length) {
      throw new NotFoundError('Uma das cartas escolhidas não existe mais.')
    }

    /*
     * Duas instruções para a leva inteira, e não três por carta.
     *
     * Eram três — somar, reler o id, guardar —, o que dá quase 400 idas ao
     * banco numa leva de 131 cartas. Com o banco em outra máquina, isso passou
     * dos 5 segundos da transação e o Postgres desfez tudo: o relato de 20/09
     * foi "confirmei, esperei, e nada foi salvo", com `P2028` no log. A conta
     * não mudou; o que mudou é que ela acontece num lugar só.
     *
     * `quantity + EXCLUDED.quantity` continua somando **no banco**, que é o que
     * impede duas levas simultâneas lerem o mesmo total e gravarem por cima uma
     * da outra.
     */
    const linhas = Prisma.join(
      valid.map((entry) => Prisma.sql`(${entry.cardVariantId}::bigint, ${entry.copies}::int)`),
    )

    await tx.$executeRaw`
      INSERT INTO collection_items (collection_id, card_variant_id, quantity)
      SELECT ${collection.id}::bigint, entrada.card_variant_id, entrada.quantity
        FROM (VALUES ${linhas}) AS entrada(card_variant_id, quantity)
      ON CONFLICT (collection_id, card_variant_id)
      DO UPDATE SET quantity = collection_items.quantity + EXCLUDED.quantity
    `

    // Possuir primeiro, guardar depois: o trigger de alocação roda por linha,
    // e a soma precisa já estar no lugar quando ele conferir.
    await tx.$executeRaw`
      INSERT INTO collection_item_locations (collection_item_id, storage_location_id, quantity)
      SELECT item.id, ${location.id}::bigint, entrada.quantity
        FROM (VALUES ${linhas}) AS entrada(card_variant_id, quantity)
        JOIN collection_items item
          ON item.collection_id = ${collection.id}::bigint
         AND item.card_variant_id = entrada.card_variant_id
      ON CONFLICT (collection_item_id, storage_location_id)
      DO UPDATE SET quantity = collection_item_locations.quantity + EXCLUDED.quantity
    `

    const copies = valid.reduce((total, entry) => total + entry.copies, 0)
    return { cards: valid.length, copies }
  }, {
    /*
     * Cinco segundos é o padrão do Prisma, e era o teto que estourava. A leva
     * agora são duas instruções, mas o teto continua explícito e maior: numa
     * leva de 200 cartas, com o banco em outra máquina e a rede ruim, o custo
     * de esperar mais um pouco é menor que o de desfazer tudo.
     */
    timeout: 20_000,
  })
}

/**
 * Junta repetidos e recusa o que não é leva.
 *
 * A mesma variante duas vezes na lista é somada em vez de recusada: a tela pode
 * mandar duas linhas da mesma carta, e o resultado esperado é a soma — não um
 * erro que a pessoa não sabe corrigir.
 */
function normalize(entries: readonly BulkEntry[]): BulkEntry[] {
  if (entries.length === 0) {
    throw new ValidationError('Escolha ao menos uma carta.')
  }

  const merged = new Map<string, BulkEntry>()

  for (const entry of entries) {
    if (!Number.isInteger(entry.copies) || entry.copies <= 0) {
      throw new ValidationError('Cada carta precisa de ao menos uma cópia.')
    }

    const key = String(entry.cardVariantId)
    const existing = merged.get(key)
    if (existing) existing.copies += entry.copies
    else merged.set(key, { cardVariantId: entry.cardVariantId, copies: entry.copies })
  }

  if (merged.size > MAX_BULK_ENTRIES) {
    throw new ValidationError(
      `Escolha no máximo ${MAX_BULK_ENTRIES} cartas diferentes por vez.`,
    )
  }

  return [...merged.values()]
}
