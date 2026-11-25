import { isPlaysetClosed, PLAYSET_SIZE } from './counting'

/**
 * A leitura de um playset, carta por carta.
 *
 * Camada: domain. Pura, sincrona, sem I/O.
 *
 * `counting.ts` responde "quantos playsets esta colecao fechou" — um numero
 * sobre a colecao inteira. Aqui a pergunta e outra: **desta carta**, quantas
 * copias existem, fechou, e ha algo que quem le precise saber sobre elas.
 *
 * A regra de quantas copias fecham e de quais tipos nao contam continua la, e e
 * reusada: duas definicoes de playset no mesmo produto seria a forma mais
 * direta de os numeros de duas telas discordarem.
 *
 * ## O aviso de outra arte
 *
 * Playset soma **todas** as artes da carta (`business-rules.md` 2.1), e e isso
 * que a regra deve fazer: para jogar, a arte nao importa. Mas quem fecha
 * playset muitas vezes quer quatro **iguais**, e um 4/4 em que uma das copias e
 * paralela aparecia como "completo" sem mais nada.
 *
 * O precedente e a **decisao 095, item 4a**, na conferencia do deck: a linha
 * diz quantas das copias que contaram sao de outra arte. Mesmo aviso, mesmo
 * motivo.
 *
 * **A diferenca e a referencia.** Na conferencia do deck a pessoa escolheu uma
 * arte, e "outra" quer dizer "diferente da escolhida". Num playset nao existe
 * arte escolhida — a linha e a carta. Entao a referencia e a **Normal**, que e
 * uma das duas unicas classificacoes que o catalogo afirma (decisao 023).
 *
 * **Nao ha resguardo para carta sem Normal.** Uma carta que so existisse em
 * arte paralela avisaria em 100% das linhas, e o aviso viraria ruido. Medido em
 * 25/11: das 2.816 cartas que contam playset, **nenhuma** esta nesse caso.
 * Escrever a guarda seria codigo que nunca roda; se um dia rodar, o lugar e
 * aqui.
 */

/** A arte sem tratamento. A outra classificacao e `Parallel` (decisao 023). */
export const NORMAL_ART = 'Normal'

/** Copias de uma arte da carta. Uma linha por variante possuida. */
export interface ArtCopies {
  variantType: string
  quantity: number
}

export interface PlaysetReading {
  /** Copias somadas de todas as artes. */
  quantity: number
  closed: boolean
  /** Quantas das copias contadas sao de arte paralela. Zero nao se exibe. */
  otherArtCopies: number
}

export function readPlayset(cardType: string, copies: readonly ArtCopies[]): PlaysetReading {
  let quantity = 0
  let otherArtCopies = 0

  for (const copy of copies) {
    if (copy.quantity <= 0) continue

    quantity += copy.quantity
    if (copy.variantType !== NORMAL_ART) otherArtCopies += copy.quantity
  }

  return { quantity, closed: isPlaysetClosed(cardType, quantity), otherArtCopies }
}

/**
 * Quantas copias faltam para fechar.
 *
 * Nunca negativo: oito copias faltam zero, e nao menos quatro. O playset e
 * binario por carta, e passar de quatro nao cria divida nem credito.
 */
export function missingCopies(quantity: number): number {
  return Math.max(0, PLAYSET_SIZE - quantity)
}
