/**
 * Impressões que a fonte omite, e que nós sabemos existir.
 *
 * Camada: domain. Puro: uma lista e o porquê de cada linha.
 *
 * ## O que é isto
 *
 * A lista de cartas da Bandai diz, em cada bloco, os produtos em que aquela
 * arte saiu — é dali que `variant_printings` nasce. Em **um** bloco de 4.844
 * conferidos em 25/11, ela simplesmente não traz esse campo.
 *
 * O parser faz o certo: não inventa, anota em `variantsWithoutSet` e segue. Mas
 * o relatório da importação é lido uma vez e esquecido, e a carta fica fora do
 * produto para sempre.
 *
 * ## Por que corrigir não é inventar
 *
 * A palavra é do dono do produto, em 25/11, achando a falha ao conferir o
 * ST-26: *"se assim que é impresso então não é erro"*. A carta está na caixa. O
 * errado é o nosso dado, e aproximá-lo da carta física é o oposto de adivinhar.
 *
 * Cada linha aqui carrega a evidência, e ela é verificável sem confiar em
 * ninguém: a própria Bandai conta **15 results** na página do ST-26, e nós
 * tínhamos 14.
 *
 * ## Por que no código, e não num arquivo curado
 *
 * Os DON!! (decisão 112) e a Liga (047) ganharam arquivo porque são centenas de
 * linhas levantadas à mão, e crescem. Isto é **uma** linha, nascida de um furo
 * da fonte, e um arquivo com uma entrada só — mais tela, mais comando, mais
 * schema — custaria mais que o problema.
 *
 * Se um dia virar dezenas, o lugar de mudar de ideia é aqui.
 *
 * ## Roda em toda importação
 *
 * Dentro de `importCatalog`, no fim, e não num comando à parte: a correção
 * precisa **sobreviver a uma reimportação**, que é justamente o que a apagaria.
 */

export interface ImpressaoAusente {
  /** O `source_id` da arte, como a fonte o escreve. */
  sourceId: string
  /** O código do set em que ela também saiu. */
  setCode: string
  /** Por que sabemos, e como conferir de novo. */
  motivo: string
}

export const IMPRESSOES_AUSENTES: readonly ImpressaoAusente[] = [
  {
    sourceId: 'ST14-010',
    setCode: 'ST-26',
    motivo:
      'O bloco ST14-010_r1 na página do ST-26 vem sem a linha "Card Set(s)" — ' +
      'o único assim em 4.844 conferidos em 25/11. A Bandai conta 15 cartas no ' +
      'ST-26 e nós tínhamos 14; a que faltava é esta, o Brook preto, encontrada ' +
      'pelo dono do produto ao conferir a composição do deck.',
  },
]
