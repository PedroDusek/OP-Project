import type { PrismaClient } from '@prisma/client'
import { NotFoundError } from '@/server/domain/errors'
import { compareSetCodes, displaySetName } from '@/server/domain/catalog/sets'

/**
 * Sets do catalogo.
 *
 * Camada: application.
 *
 * A contagem vem de `variant_printings`, nunca do prefixo do codigo — e a mesma
 * regra que o progresso por set segue (`business-rules.md` 2.2), e a razao de
 * `OP14-EB04` existir: uma variante pode ser impressa em mais de um set.
 *
 * Sao 60 sets. Buscar todos e ordenar em memoria custa menos que ensinar a
 * ordenacao natural ao SQL, e mantem a regra num lugar so, testavel sem banco.
 */

export interface SetSummary {
  code: string
  /** Nome como a fonte publicou. */
  name: string
  /** Nome sem os hifens decorativos, para exibir. */
  displayName: string
  /** Variantes impressas neste set. */
  variantCount: number
}

export async function listSets(prisma: PrismaClient): Promise<SetSummary[]> {
  const rows = await prisma.set.findMany({
    select: { code: true, name: true, _count: { select: { printings: true } } },
  })

  return rows
    .map((row) => ({
      code: row.code,
      name: row.name,
      displayName: displaySetName(row.name),
      variantCount: row._count.printings,
    }))
    .sort((a, b) => compareSetCodes(a.code, b.code))
}

export async function getSet(prisma: PrismaClient, code: string): Promise<SetSummary> {
  const row = await prisma.set.findUnique({
    where: { code },
    select: { code: true, name: true, _count: { select: { printings: true } } },
  })

  if (!row) throw new NotFoundError('Set nao encontrado.')

  return {
    code: row.code,
    name: row.name,
    displayName: displaySetName(row.name),
    variantCount: row._count.printings,
  }
}
