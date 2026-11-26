import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import {
  MAX_COPIES_PER_CARD,
  validateStarterDecks,
  type StarterDeckEntry,
} from '@/server/domain/catalog/starter-decks'

/**
 * O arquivo `data/starter-decks.json`: quantas cópias de cada carta vêm em cada ST.
 *
 * Camada: infrastructure. Lê, confere e grava — a regra é do domínio
 * (`domain/catalog/starter-decks.ts`), e é lá que está o porquê da tabela.
 *
 * Mesmo desenho do arquivo dos DON!! e do da Liga, e de propósito: são a mesma
 * coisa — conhecimento levantado à mão, que precisa chegar a produção por PR.
 *
 * Arquivo inválido é **erro**, e não tabela vazia: tabela vazia apagaria as
 * conferências já feitas sem ninguém ver (armadilha 5).
 */

export const STARTER_DECKS_PATH = resolve(process.cwd(), 'data', 'starter-decks.json')

const fileSchema = z
  .object({
    decks: z.array(
      z
        .object({
          deck: z.string().trim().min(1).max(20),
          cartas: z
            .array(
              z
                .object({
                  carta: z.string().trim().min(1).max(20),
                  copias: z.number().int().min(1).max(MAX_COPIES_PER_CARD),
                })
                .strict(),
            )
            .max(60),
        })
        // Chave desconhecida e erro: `carta` no lugar de `cartas` viraria um
        // deck sem nenhuma linha sem ninguem ver.
        .strict(),
    ),
  })
  .strict()

export function parseStarterDecks(json: unknown): StarterDeckEntry[] {
  const parsed = fileSchema.safeParse(json)
  if (!parsed.success) {
    const onde = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('; ')
    throw new Error(`Tabela dos starter decks: formato inválido — ${onde}.`)
  }
  return validateStarterDecks(parsed.data.decks)
}

export function loadStarterDecks(path: string = STARTER_DECKS_PATH): StarterDeckEntry[] {
  let json: unknown
  try {
    json = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(
      `Tabela dos starter decks: não foi possível ler ${path} ` +
        `(${error instanceof Error ? error.message : error}).`,
    )
  }
  return parseStarterDecks(json)
}

/** O texto estável — ordenado, dois espaços, quebra no fim —, porque vai para PR. */
export function serializeStarterDecks(entries: readonly StarterDeckEntry[]): string {
  return `${JSON.stringify({ decks: validateStarterDecks(entries) }, null, 2)}\n`
}

export function saveStarterDecks(
  entries: readonly StarterDeckEntry[],
  path: string = STARTER_DECKS_PATH,
): void {
  writeFileSync(path, serializeStarterDecks(entries), 'utf8')
}
