import { z } from 'zod'
import { CARD_TYPES } from '@/server/domain/catalog/types'

/**
 * Schemas de entrada do catalogo.
 *
 * Camada: http. Tudo chega como string na query, entao a coercao acontece aqui
 * e o caso de uso recebe tipos ja corretos.
 */

/** "1", "true" e "sim" valem true; "0", "false" e "nao" valem false. */
const booleanish = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .refine((v) => ['1', '0', 'true', 'false', 'sim', 'nao'].includes(v), {
    message: 'Use true ou false.',
  })
  .transform((v) => ['1', 'true', 'sim'].includes(v))

const integer = (label: string) =>
  z
    .string()
    .refine((v) => /^-?\d+$/.test(v.trim()), { message: `${label} deve ser um numero inteiro.` })
    .transform((v) => Number.parseInt(v, 10))

const nonEmpty = (max: number) => z.string().trim().min(1).max(max)

export const catalogQuerySchema = z.object({
  code: nonEmpty(20).optional(),
  name: nonEmpty(150).optional(),
  setCode: nonEmpty(20).optional(),
  type: z.enum(CARD_TYPES).optional(),
  color: nonEmpty(50).optional(),
  trait: nonEmpty(100).optional(),
  attribute: nonEmpty(50).optional(),
  mechanic: nonEmpty(100).optional(),
  effect: nonEmpty(100).optional(),
  rarity: nonEmpty(50).optional(),
  variantType: nonEmpty(50).optional(),
  cost: integer('cost').optional(),
  power: integer('power').optional(),
  counter: integer('counter').optional(),
  hasTrigger: booleanish.optional(),
  blockIcon: nonEmpty(20).optional(),
  page: integer('page').pipe(z.number().int().min(1)).optional(),
  // O teto tambem existe no caso de uso; aqui ele vira erro explicito em vez de
  // silenciosamente reduzido, para o cliente saber que pediu demais.
  pageSize: integer('pageSize').pipe(z.number().int().min(1).max(100)).optional(),
})

export type CatalogQueryInput = z.infer<typeof catalogQuerySchema>

/** Id de rota. Vem como string e vira BigInt, porque todo id do modelo e bigint. */
export const variantIdSchema = z
  .string()
  .refine((v) => /^\d+$/.test(v), { message: 'Identificador invalido.' })
  .transform((v) => BigInt(v))
