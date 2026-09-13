import { parseLigaUrl } from './liga'

/**
 * A tabela de correspondência entre as artes da Bandai e as páginas da Liga.
 *
 * Camada: domain. Puro: o formato e a regra de consistência. Ler e gravar o
 * arquivo é da infraestrutura.
 *
 * ## Por que existe (decisão 071)
 *
 * A Liga não cadastrou as coleções do mesmo jeito — `-PAR` na OP01, `-E` na
 * OP02 —, e a paralela de uma carta pode ter sido lançada em outro produto. Não
 * há regra que derive o endereço da paralela sem errar, e o sistema não pode ler
 * a Liga (decisão 047). O que resolve é alguém abrir a página e registrar.
 *
 * ## Num arquivo, e indexado pela arte da Bandai
 *
 * Pelo mesmo motivo do arquivo de vínculos manuais (decisão 068): é julgamento
 * de gente, e precisa sobreviver a banco recriado e passar por revisão. A chave
 * é o `source_id` — `OP01-001_p1` —, que sobrevive a catálogo reimportado.
 *
 * ## `url: null` é uma resposta
 *
 * "Conferi, e a Liga não tem página para esta arte." A arte vai para a busca, e
 * a tela de conferência deixa de oferecê-la.
 *
 * ## Guarda o endereço como a Liga produziu
 *
 * E não as partes para montar de novo. O nome dentro do endereço nem sempre é o
 * nosso — o Kid da OP01 aparece como `Eustass"Captain"Kid (Parallel)` —, e
 * remontar seria apostar que a Liga ignora a diferença.
 */

export interface LigaCardEntry {
  /** O `source_id` da arte: `OP01-001_p1`. */
  arte: string
  /** O endereço conferido, ou `null` quando a Liga não tem página. */
  url: string | null
  /** Um lembrete curto de quem conferiu, quando o caso pediu explicação. */
  nota?: string
}

/** Confere repetição e forma do endereço, e devolve ordenado por arte. */
export function validateLigaCards(entries: readonly LigaCardEntry[]): LigaCardEntry[] {
  const vezes = new Map<string, number>()
  const problemas: string[] = []

  for (const entry of entries) {
    vezes.set(entry.arte, (vezes.get(entry.arte) ?? 0) + 1)
    if (entry.url !== null) {
      const lido = parseLigaUrl(entry.url)
      if ('error' in lido) problemas.push(`${entry.arte}: ${lido.error}`)
    }
  }
  for (const [arte, n] of vezes) {
    if (n > 1) problemas.push(`a arte ${arte} aparece ${n} vezes`)
  }

  if (problemas.length > 0) {
    throw new Error(`Tabela da Liga inconsistente: ${problemas.join('; ')}.`)
  }

  // A ordem por arte mantem o diff de um PR de conferencia legivel: a linha nova
  // aparece onde a carta esta, e nao no fim.
  return [...entries].sort((a, b) => (a.arte < b.arte ? -1 : a.arte > b.arte ? 1 : 0))
}

/** A tabela como consulta: arte → endereço ou `null`. Ausente é "não conferida". */
export function ligaLookup(entries: readonly LigaCardEntry[]): ReadonlyMap<string, string | null> {
  return new Map(entries.map((entry) => [entry.arte, entry.url]))
}
