import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'

/**
 * O levantamento dos conflitos entre a Liga e os vínculos, `liga-conflitos.json`.
 *
 * Camada: infrastructure.
 *
 * ## Por que um arquivo, e fora do Git
 *
 * Saber o tratamento do produto vinculado exige ler a fonte de preço inteira — 174
 * pedidos. A tela não pode fazer isso a cada visita, pelo mesmo motivo do
 * levantamento das paralelas (`paralelas-candidatas.json`): um script lê uma vez e
 * grava aqui. É dado derivado e regenerável, e por isso fica fora do Git.
 */

export const LIGA_CONFLICTS_PATH = resolve(process.cwd(), 'liga-conflitos.json')

const produto = z.object({
  productId: z.string(),
  label: z.string(),
  groupCode: z.string().nullable(),
  value: z.number().nullable(),
})

const fileSchema = z.object({
  geradoEm: z.string(),
  conflitos: z.array(
    z.object({
      sourceId: z.string(),
      cardCode: z.string(),
      cardName: z.string(),
      rarity: z.string().nullable(),
      imageUrl: z.string().nullable(),
      sets: z.array(z.string()),
      liga: z.object({ url: z.string(), nome: z.string(), ed: z.string().nullable(), tratamento: z.string() }),
      vinculado: produto,
      produtos: z.array(produto),
    }),
  ),
})

export type LigaConflictsFile = z.infer<typeof fileSchema>
export type LigaConflict = LigaConflictsFile['conflitos'][number]
export type LigaConflictProduct = LigaConflict['produtos'][number]

/** `null` quando o levantamento ainda não foi gerado: a tela diz como gerar. */
export function loadLigaConflicts(path: string = LIGA_CONFLICTS_PATH): LigaConflictsFile | null {
  if (!existsSync(path)) return null
  return fileSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
}

export function saveLigaConflicts(
  conflitos: readonly LigaConflict[],
  path: string = LIGA_CONFLICTS_PATH,
  now: Date = new Date(),
): void {
  const conteudo: LigaConflictsFile = { geradoEm: now.toISOString(), conflitos: [...conflitos] }
  writeFileSync(path, `${JSON.stringify(conteudo, null, 2)}\n`, 'utf8')
}
