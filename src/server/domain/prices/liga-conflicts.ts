import { ligaIdentity, sourceTreatmentKey, type LigaArt } from './liga-treatment'

/**
 * O vínculo automático que discorda do nome que a Liga conferiu (decisão 074).
 *
 * Camada: domain. Puro.
 *
 * ## Por que existe
 *
 * A regra da Liga recusa formar um par que contradiga o nome conferido (073), mas
 * recusar não apaga o que a regra antiga — o caso sem escolha (053) — já tinha
 * gravado antes de a Liga existir. Medido em 15/09: a Liga diz `Parallel` e o
 * vínculo está numa `Manga` de US$ 2.001; a Liga diz `SP` e o vínculo está num
 * `TR` de US$ 275.
 *
 * Quem erra — o vínculo ou a página da Liga — só o olho diz. A tela
 * `/dev/liga/conflitos` mostra os dois lados, e nada muda sozinho: a resposta vai
 * para o arquivo de vínculos manuais, que vence qualquer regra.
 *
 * ## Só com o nome dito
 *
 * Arte sem tratamento na página da própria coleção não conflita com nada: não há
 * o que comparar. A página sem tratamento de **outra** coleção diz que a arte não
 * tem tratamento, e conflita com produto que tem — a `OP01-016_p9` (Nami do ST31)
 * estava numa SP da EB-05. A comparação é a mesma da regra — sinônimos, pontuação
 * e o pedaço do nome da carta —, para a tela nunca acusar o que a importação
 * aceitaria.
 */

export interface LigaConflictCheck {
  art: Omit<LigaArt, 'variantId'>
  /** O tratamento do produto vinculado, como a fonte escreve. */
  linkedLabel: string
}

/** O tratamento que a Liga dá à arte, quando ele discorda do produto vinculado; senão `null`. */
export function ligaConflict({ art, linkedLabel }: LigaConflictCheck): string | null {
  const { tratamento, chave } = ligaIdentity(art)
  if (chave === null) return null
  if (tratamento === null) return sourceTreatmentKey(linkedLabel, art.cardName) === '' ? null : chave
  return sourceTreatmentKey(linkedLabel, art.cardName) === tratamento ? null : tratamento
}
