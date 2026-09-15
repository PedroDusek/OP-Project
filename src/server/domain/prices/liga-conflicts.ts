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
 * Arte sem tratamento na Liga não conflita com nada: não há o que comparar. E a
 * comparação é a mesma da regra — sinônimos, pontuação e o pedaço do nome da
 * carta —, para a tela nunca acusar o que a importação aceitaria.
 */

export interface LigaConflictCheck {
  art: Omit<LigaArt, 'variantId'>
  /** O tratamento do produto vinculado, como a fonte escreve. */
  linkedLabel: string
}

/** O tratamento que a Liga dá à arte, quando ele discorda do produto vinculado; senão `null`. */
export function ligaConflict({ art, linkedLabel }: LigaConflictCheck): string | null {
  const { tratamento } = ligaIdentity(art)
  if (tratamento === null) return null
  return sourceTreatmentKey(linkedLabel, art.cardName) === tratamento ? null : tratamento
}
