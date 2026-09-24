/**
 * A tabela que diz em que coleção cada DON!! saiu (decisão 112).
 *
 * Camada: domain. Puro: confere e ordena, não lê disco nem banco.
 *
 * ## Por que existe uma tabela, e não um palpite
 *
 * O tcgcsv agrupa os DON!! por produto do TCGplayer, e esses grupos não são as
 * nossas coleções — a abreviação de lá é `OP18`, `EB-05`, `OP18 RE`, e o nosso
 * código vem da Bandai. Deduzir a correspondência seria adivinhar vínculo, que
 * é o que já custou 773 conferências manuais neste projeto.
 *
 * Então quem diz é gente, uma carta por vez, e o que a pessoa diz mora aqui.
 *
 * ## Por que num arquivo, e não direto no banco
 *
 * Pelo mesmo motivo da tabela da Liga: são centenas de vínculos feitos à mão, e
 * eles precisam sobreviver a um banco recriado e chegar a produção por PR. Não
 * há backup do banco — o risco está registrado —, e perder isto seria perder
 * trabalho que não se refaz sozinho.
 */

export interface DonSetEntry {
  /** O `source_id` da arte, que no DON!! é o `productId` do TCGplayer. */
  arte: string
  /** Os códigos de set em que ela saiu. O set artificial `DON` não entra aqui. */
  sets: string[]
}

/**
 * Confere a tabela inteira e devolve a versão ordenada.
 *
 * Recusa em vez de consertar, e é de propósito: uma arte repetida com listas
 * diferentes não tem resposta certa, e escolher uma delas em silêncio gravaria
 * um vínculo que ninguém pediu (armadilha 5).
 */
export function validateDonSets(entries: readonly DonSetEntry[]): DonSetEntry[] {
  const vistas = new Set<string>()

  for (const entry of entries) {
    const arte = entry.arte.trim()
    if (arte === '') throw new Error('Tabela de sets do DON!!: há uma entrada sem arte.')
    if (vistas.has(arte)) {
      throw new Error(`Tabela de sets do DON!!: a arte ${arte} aparece mais de uma vez.`)
    }
    vistas.add(arte)

    const limpos = entry.sets.map((code) => code.trim()).filter((code) => code !== '')
    if (limpos.length !== new Set(limpos).size) {
      throw new Error(`Tabela de sets do DON!!: a arte ${arte} repete um set.`)
    }
  }

  return entries
    .map((entry) => ({
      arte: entry.arte.trim(),
      // Ordenado para o arquivo não mudar de texto sem mudar de conteúdo: ele
      // vai para PR, e diff de ordem esconde diff de valor.
      sets: [...new Set(entry.sets.map((code) => code.trim()).filter((code) => code !== ''))].sort(),
    }))
    // Arte sem nenhum set sai da tabela: "não sei de onde é" é a ausência, e
    // guardar uma lista vazia faria o arquivo crescer com nada dentro.
    .filter((entry) => entry.sets.length > 0)
    .sort((a, b) => a.arte.localeCompare(b.arte, 'en'))
}
