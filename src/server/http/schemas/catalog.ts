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

/**
 * Filtro que aceita um valor ou varios.
 *
 * `?cor=Black&cor=Blue` chega como lista; `?cor=Black`, como string. As duas
 * formas viram lista aqui, para o caso de uso nao ter de saber a diferenca.
 *
 * O teto de vinte nao e capricho: cada valor vira um item de `IN`, e uma URL
 * com mil cores repetidas viraria uma consulta cara feita de graca.
 */
const MAX_VALUES_PER_FILTER = 20

const multi = <T extends z.ZodTypeAny>(item: T) =>
  z
    .union([item, z.array(item).min(1).max(MAX_VALUES_PER_FILTER)])
    .transform((value) => (Array.isArray(value) ? value : [value]) as z.infer<T>[])

export const catalogQuerySchema = z.object({
  search: nonEmpty(150).optional(),
  code: nonEmpty(20).optional(),
  name: nonEmpty(150).optional(),
  setCode: nonEmpty(20).optional(),
  type: multi(z.enum(CARD_TYPES)).optional(),
  color: multi(nonEmpty(50)).optional(),
  trait: multi(nonEmpty(100)).optional(),
  attribute: multi(nonEmpty(50)).optional(),
  mechanic: multi(nonEmpty(100)).optional(),
  effect: multi(nonEmpty(100)).optional(),
  rarity: multi(nonEmpty(50)).optional(),
  variantType: multi(nonEmpty(50)).optional(),
  costMin: integer('costMin').optional(),
  costMax: integer('costMax').optional(),
  powerMin: integer('powerMin').optional(),
  powerMax: integer('powerMax').optional(),
  counter: integer('counter').optional(),
  hasTrigger: booleanish.optional(),
  blockIcon: nonEmpty(20).optional(),
  page: integer('page').pipe(z.number().int().min(1)).optional(),
  // O teto tambem existe no caso de uso; aqui ele vira erro explicito em vez de
  // silenciosamente reduzido, para o cliente saber que pediu demais.
  pageSize: integer('pageSize').pipe(z.number().int().min(1).max(100)).optional(),
})
  /*
   * Parametro desconhecido e **erro**, nao silencio.
   *
   * Sem `strict`, `?custo=3` — em portugues, ou com um typo — passaria batido e
   * devolveria o catalogo inteiro, e quem chamou acharia que filtrou. E o mesmo
   * modo de falha que ja custou caro na importacao: descarte silencioso e pior
   * que rejeicao, porque a rejeicao pelo menos avisa.
   */
  .strict()

export type CatalogQueryInput = z.infer<typeof catalogQuerySchema>

/** Id de rota. Vem como string e vira BigInt, porque todo id do modelo e bigint. */
export const variantIdSchema = z
  .string()
  .refine((v) => /^\d+$/.test(v), { message: 'Identificador invalido.' })
  .transform((v) => BigInt(v))
