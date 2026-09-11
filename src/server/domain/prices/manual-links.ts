/**
 * Os vínculos que o dono do produto fez à mão.
 *
 * Camada: domain. Puro: o formato e a regra de consistência. Ler e gravar o
 * arquivo é da infraestrutura.
 *
 * ## Por que num arquivo, e não só no banco
 *
 * O vínculo manual é o que custa tempo de gente — olhar duas artes e dizer qual
 * é qual. A decisão 053 o protege de ser sobrescrito por regra; faltava
 * protegê-lo de tudo o mais (decisão 068):
 *
 * - de um banco local recriado, que o apagaria;
 * - de produção, que não o receberia sem um comando à parte;
 * - da falta de revisão, porque uma linha no banco não passa por PR.
 *
 * No repositório ele é versionado, revisado junto do código, e aplicado pela
 * mesma importação de preço em qualquer ambiente, produção incluída.
 *
 * ## Indexado pelo id da Bandai, e não pelo do banco
 *
 * `variante` é o `source_id` da arte — `OP01-016_p3`. O id numérico do banco
 * muda quando o catálogo é reimportado num banco limpo; o da Bandai é o que a
 * importação usa para ser determinística (decisão 019), e sobrevive.
 *
 * ## `produto: null` é uma resposta, e não ausência
 *
 * Quer dizer "olhei, e a fonte não tem esta arte". Sem isso, uma carta revisada e
 * uma não revisada seriam indistinguíveis, e a tela de mapeamento a ofereceria de
 * novo para sempre.
 */

export interface ManualLink {
  /** O `source_id` da nossa arte: `OP01-016_p3`. */
  variante: string
  /** O id do produto na fonte, ou `null` quando a fonte não tem esta arte. */
  produto: string | null
  /** Um lembrete curto de quem mapeou, quando o caso pediu explicação. */
  nota?: string
}

/**
 * Confere o que o banco não conferiria sozinho, e devolve ordenado.
 *
 * Duas regras, e as duas espelham índices únicos de `variant_source_products`:
 * uma arte aponta para um produto só, e um produto pertence a uma arte só. Pegar
 * isso aqui, e não na escrita, faz o erro aparecer com o nome da arte repetida em
 * vez de uma violação de índice no meio da importação de preço.
 *
 * A ordem por `variante` não é estética: é o que mantém o diff de um PR de
 * mapeamento legível — uma linha nova aparece onde a carta está, e não no fim.
 */
export function validateManualLinks(links: readonly ManualLink[]): ManualLink[] {
  const variantes = new Map<string, number>()
  const produtos = new Map<string, string[]>()

  for (const link of links) {
    variantes.set(link.variante, (variantes.get(link.variante) ?? 0) + 1)
    if (link.produto !== null) {
      produtos.set(link.produto, [...(produtos.get(link.produto) ?? []), link.variante])
    }
  }

  const problemas: string[] = []
  for (const [variante, vezes] of variantes) {
    if (vezes > 1) problemas.push(`a arte ${variante} aparece ${vezes} vezes`)
  }
  for (const [produto, artes] of produtos) {
    if (artes.length > 1) problemas.push(`o produto ${produto} foi dado a ${artes.join(' e ')}`)
  }

  if (problemas.length > 0) {
    throw new Error(`Vínculos manuais inconsistentes: ${problemas.join('; ')}.`)
  }

  return [...links].sort((a, b) => (a.variante < b.variante ? -1 : a.variante > b.variante ? 1 : 0))
}
