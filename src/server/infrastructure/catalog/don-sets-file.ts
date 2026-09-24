import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import { validateDonSets, type DonSetEntry } from '@/server/domain/catalog/don-sets'

/**
 * O arquivo `data/don-sets.json`: em que coleção cada DON!! saiu.
 *
 * Camada: infrastructure. Lê, confere e grava — a regra é do domínio
 * (`domain/catalog/don-sets.ts`), e é lá que está o porquê da tabela.
 *
 * Mesmo desenho do arquivo da Liga, e de propósito: são a mesma coisa —
 * conhecimento levantado à mão, que precisa chegar a produção por PR.
 *
 * Arquivo inválido é **erro**, e não tabela vazia: tabela vazia apagaria os
 * vínculos já feitos sem ninguém ver (armadilha 5).
 */

export const DON_SETS_PATH = resolve(process.cwd(), 'data', 'don-sets.json')

const fileSchema = z
  .object({
    cartas: z.array(
      z
        .object({
          arte: z.string().trim().min(1).max(60),
          sets: z.array(z.string().trim().min(1).max(20)).max(20),
        })
        // Chave desconhecida e erro: `set` no lugar de `sets` viraria uma arte
        // sem colecao nenhuma sem ninguem ver.
        .strict(),
    ),
  })
  .strict()

export function parseDonSets(json: unknown): DonSetEntry[] {
  const parsed = fileSchema.safeParse(json)
  if (!parsed.success) {
    const onde = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('; ')
    throw new Error(`Tabela de sets do DON!!: formato inválido — ${onde}.`)
  }
  return validateDonSets(parsed.data.cartas)
}

export function loadDonSets(path: string = DON_SETS_PATH): DonSetEntry[] {
  let json: unknown
  try {
    json = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(
      `Tabela de sets do DON!!: não foi possível ler ${path} (${error instanceof Error ? error.message : error}).`,
    )
  }
  return parseDonSets(json)
}

/** O texto estável — ordenado, dois espaços, quebra no fim —, porque vai para PR. */
export function serializeDonSets(entries: readonly DonSetEntry[]): string {
  return `${JSON.stringify({ cartas: validateDonSets(entries) }, null, 2)}\n`
}

export function saveDonSets(entries: readonly DonSetEntry[], path: string = DON_SETS_PATH): void {
  writeFileSync(path, serializeDonSets(entries), 'utf8')
}
