import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import { validateLigaCards, type LigaCardEntry } from '@/server/domain/catalog/liga-cards'
import bundled from '../../../../data/liga-cartas.json'

/**
 * O arquivo da tabela da Liga, `data/liga-cartas.json`.
 *
 * Camada: infrastructure. Lê, confere e grava — a regra é do domínio
 * (`domain/catalog/liga-cards.ts`), e é lá que está o porquê da tabela.
 *
 * ## Duas leituras do mesmo arquivo, de propósito
 *
 * - **O link da carta** usa o JSON importado (`bundledLigaCards`). Importado, ele
 *   entra no pacote do servidor em qualquer hospedagem; lido do disco em tempo de
 *   execução, dependeria de o arquivo ser copiado junto, o que nem toda
 *   hospedagem faz sem configuração. Em desenvolvimento, o `next dev` recompila
 *   quando o arquivo muda.
 * - **A tela de conferência** lê e grava no disco (`loadLigaCards`,
 *   `saveLigaCards`), porque precisa ver o que acabou de gravar.
 *
 * ## Arquivo inválido é erro, e não tabela vazia
 *
 * Tabela vazia manda toda paralela para a busca: um erro de digitação apagaria
 * os links conferidos sem ninguém ver. Descarte silencioso é pior que rejeição
 * (armadilha 5).
 */

export const LIGA_CARDS_PATH = resolve(process.cwd(), 'data', 'liga-cartas.json')

const fileSchema = z
  .object({
    cartas: z.array(
      z
        .object({
          arte: z.string().trim().min(1).max(60),
          url: z.string().trim().min(1).max(500).nullable(),
          nota: z.string().trim().max(200).optional(),
        })
        // Chave desconhecida e erro: um `URL` digitado no lugar de `url` viraria
        // uma arte "sem pagina" sem ninguem ver.
        .strict(),
    ),
  })
  .strict()

export function parseLigaCards(json: unknown): LigaCardEntry[] {
  const parsed = fileSchema.safeParse(json)
  if (!parsed.success) {
    const onde = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('; ')
    throw new Error(`Tabela da Liga: formato inválido — ${onde}.`)
  }
  return validateLigaCards(parsed.data.cartas)
}

/** A tabela que foi para o pacote: é a que decide o link da carta. */
export function bundledLigaCards(): LigaCardEntry[] {
  return parseLigaCards(bundled)
}

export function loadLigaCards(path: string = LIGA_CARDS_PATH): LigaCardEntry[] {
  let json: unknown
  try {
    json = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(
      `Tabela da Liga: não foi possível ler ${path} (${error instanceof Error ? error.message : error}).`,
    )
  }
  return parseLigaCards(json)
}

/** O texto estável — ordenado por arte, dois espaços, quebra no fim —, porque vai para PR. */
export function serializeLigaCards(entries: readonly LigaCardEntry[]): string {
  const cartas = validateLigaCards(entries).map((entry) => ({
    arte: entry.arte,
    url: entry.url,
    ...(entry.nota ? { nota: entry.nota } : {}),
  }))
  return `${JSON.stringify({ cartas }, null, 2)}\n`
}

export function saveLigaCards(entries: readonly LigaCardEntry[], path: string = LIGA_CARDS_PATH): void {
  writeFileSync(path, serializeLigaCards(entries), 'utf8')
}
