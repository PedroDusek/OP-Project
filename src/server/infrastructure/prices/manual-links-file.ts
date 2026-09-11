import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import { validateManualLinks, type ManualLink } from '@/server/domain/prices/manual-links'

/**
 * O arquivo de vínculos manuais, `data/vinculos-manuais.json`.
 *
 * Camada: infrastructure. Lê, confere e grava — a regra de consistência é do
 * domínio (`domain/prices/manual-links.ts`), e é lá que está o porquê do arquivo.
 *
 * ## Arquivo que falta é erro, e não lista vazia
 *
 * A importação de preço de produção aplica este arquivo. Se ele sumisse e isso
 * virasse "nenhum vínculo manual", produção perderia o trabalho do dono do
 * produto em silêncio, na próxima importação — e ninguém saberia até alguém
 * perguntar por que a Nami parou de ter preço. Descarte silencioso é pior que
 * rejeição (armadilha 5).
 */

export const MANUAL_LINKS_PATH = resolve(process.cwd(), 'data', 'vinculos-manuais.json')

const SOURCE = 'tcgcsv'

const fileSchema = z
  .object({
    fonte: z.literal(SOURCE),
    vinculos: z.array(
      z
        .object({
          variante: z.string().trim().min(1).max(60),
          // O id de produto da fonte e sempre numero; texto no schema do banco
          // porque nem toda fonte usaria numero, mas esta usa.
          produto: z.string().regex(/^\d+$/, 'produto deve ser o id numerico da fonte').nullable(),
          nota: z.string().trim().max(200).optional(),
        })
        // Chave desconhecida e erro: um `produtos` digitado no lugar de
        // `produto` viraria um vinculo em branco sem ninguem ver.
        .strict(),
    ),
  })
  .strict()

/** Lê o texto do arquivo e devolve os vínculos conferidos, ou lança dizendo o quê. */
export function parseManualLinks(text: string): ManualLink[] {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (error) {
    throw new Error(
      `Vínculos manuais: o arquivo não é JSON válido (${error instanceof Error ? error.message : error}).`,
    )
  }

  const parsed = fileSchema.safeParse(json)
  if (!parsed.success) {
    const onde = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('; ')
    throw new Error(`Vínculos manuais: formato inválido — ${onde}.`)
  }

  return validateManualLinks(parsed.data.vinculos)
}

export function loadManualLinks(path: string = MANUAL_LINKS_PATH): ManualLink[] {
  return parseManualLinks(readFileSync(path, 'utf8'))
}

/**
 * O texto do arquivo, estável: ordenado por arte, dois espaços, quebra no fim.
 *
 * Estável porque ele vai para PR. Uma gravação que reordenasse as chaves ou
 * mudasse a indentação faria cada mapeamento parecer uma reescrita do arquivo
 * inteiro no diff.
 */
export function serializeManualLinks(links: readonly ManualLink[]): string {
  const vinculos = validateManualLinks(links).map((link) => ({
    variante: link.variante,
    produto: link.produto,
    ...(link.nota ? { nota: link.nota } : {}),
  }))
  return `${JSON.stringify({ fonte: SOURCE, vinculos }, null, 2)}\n`
}

export function saveManualLinks(links: readonly ManualLink[], path: string = MANUAL_LINKS_PATH): void {
  writeFileSync(path, serializeManualLinks(links), 'utf8')
}
