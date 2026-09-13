import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import type { ParallelCandidate } from '@/server/domain/prices/parallel-candidates'

/**
 * O arquivo de candidatos ao mapeamento manual, `paralelas-candidatas.json`.
 *
 * Camada: infrastructure.
 *
 * ## Por que um arquivo, e fora do Git
 *
 * Saber o que a fonte oferece exige ler os 87 arquivos dela — 174 pedidos. A tela
 * de mapeamento não pode fazer isso a cada carregamento: seria carga à toa sobre
 * infraestrutura de terceiro, a mesma que a decisão 020 manda poupar.
 *
 * Então um script lê a fonte uma vez e grava aqui o que ficou pendente. É dado
 * **derivado** e regenerável — por isso fica fora do Git, ao contrário do arquivo
 * de vínculos manuais, que é julgamento de gente e não se regenera.
 */

export const PARALLEL_CANDIDATES_PATH = resolve(process.cwd(), 'paralelas-candidatas.json')

const fileSchema = z.object({
  geradoEm: z.string(),
  cartas: z.array(
    z.object({
      cardCode: z.string(),
      cardName: z.string(),
      setCode: z.string().nullable(),
      ours: z.array(
        z.object({ sourceId: z.string(), rarity: z.string().nullable(), imageUrl: z.string().nullable() }),
      ),
      theirs: z.array(
        z.object({ productId: z.string(), label: z.string(), value: z.number().nullable() }),
      ),
    }),
  ),
})

export interface ParallelCandidatesFile {
  geradoEm: string
  cartas: ParallelCandidate[]
}

/** `null` quando o levantamento ainda não foi gerado: a tela diz como gerar. */
export function loadParallelCandidates(
  path: string = PARALLEL_CANDIDATES_PATH,
): ParallelCandidatesFile | null {
  if (!existsSync(path)) return null
  return fileSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
}

export function saveParallelCandidates(
  cartas: readonly ParallelCandidate[],
  path: string = PARALLEL_CANDIDATES_PATH,
  now: Date = new Date(),
): void {
  const conteudo: ParallelCandidatesFile = { geradoEm: now.toISOString(), cartas: [...cartas] }
  writeFileSync(path, `${JSON.stringify(conteudo, null, 2)}\n`, 'utf8')
}
