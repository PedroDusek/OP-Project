import { matchQuantity, remainingToGet } from '@/server/domain/wants/status'

/**
 * O cruzamento entre o que uma pessoa oferece e o que a outra quer.
 *
 * Camada: domain. Puro, síncrono, sem I/O.
 *
 * ## Só dentro de uma troca
 *
 * Isto nunca roda contra estranhos. O cruzamento só acontece depois que as duas
 * pessoas entraram na troca (`business-rules.md` 4.6.1) — é o consentimento das
 * duas que autoriza o dado privado de uma a encostar no da outra. Não existe
 * vitrine, e esta função não sabe encontrar ninguém: recebe os dois lados já
 * autorizados.
 *
 * ## Duas direções, e a mesma regra nas duas
 *
 * Uma troca tem dois sentidos, e cada um é a regra 4.3 aplicada uma vez: o
 * mínimo entre o que um tem disponível e o que ainda falta ao outro. Rodar a
 * mesma função com os lados invertidos é o que garante que os dois sentidos
 * sigam o mesmo critério — o dia em que divergirem, um lado vai parecer injusto
 * sem que ninguém saiba dizer por quê.
 *
 * ## Sugestão, não obrigação
 *
 * Um match não é persistido e não compromete cópia nenhuma (regra 4.3). É o
 * ponto de partida da conversa; o que vale é o que cada um coloca na própria
 * oferta depois.
 */

/** Uma carta disponível para troca, do lado de quem oferece. */
export interface AvailableCard {
  variantId: string
  /** Cópias em armazenamento de troca. */
  quantity: number
}

/** Um item da want list, do lado de quem procura. */
export interface WantedCard {
  variantId: string
  /** Quantas a pessoa quer ao todo. */
  wanted: number
  /** Quantas ela já tem, de qualquer variante desta mesma arte. */
  owned: number
}

export interface CrossedCard {
  variantId: string
  /** Quanto o match pode cobrir: o mínimo entre disponível e o que falta. */
  quantity: number
  /** Cópias que quem oferece tem à disposição, para a tela dar contexto. */
  available: number
  /** Quantas ainda faltam a quem quer, mesmo que o outro não cubra tudo. */
  stillWanted: number
}

/**
 * O que quem oferece tem e quem procura quer.
 *
 * Devolve só o que dá match de verdade: quantidade zero não é um match fraco, é
 * a ausência de um. Uma lista cheia de zeros faria a pessoa procurar o que
 * interessa no meio do que não interessa.
 */
export function crossOffer(
  available: readonly AvailableCard[],
  wanted: readonly WantedCard[],
): CrossedCard[] {
  const wantedByVariant = new Map(wanted.map((item) => [item.variantId, item]))
  const crossed: CrossedCard[] = []

  for (const offer of available) {
    const want = wantedByVariant.get(offer.variantId)
    if (!want) continue

    const stillWanted = remainingToGet(want.owned, want.wanted)
    const quantity = matchQuantity(offer.quantity, stillWanted)
    if (quantity <= 0) continue

    crossed.push({
      variantId: offer.variantId,
      quantity,
      available: offer.quantity,
      stillWanted,
    })
  }

  return crossed
}

export interface TradeCrossing {
  /** O que o primeiro lado pode dar ao segundo. */
  fromFirst: CrossedCard[]
  /** O que o segundo lado pode dar ao primeiro. */
  fromSecond: CrossedCard[]
}

export interface TradeSide {
  available: readonly AvailableCard[]
  wanted: readonly WantedCard[]
}

/**
 * As duas direções de uma troca, de uma vez.
 *
 * Existe para que nenhuma tela precise lembrar de inverter os lados na segunda
 * chamada — inverter errado produziria uma lista plausível e falsa, que é o
 * pior tipo de defeito num lugar onde as pessoas combinam dar coisas uma à
 * outra.
 */
export function crossTrade(first: TradeSide, second: TradeSide): TradeCrossing {
  return {
    fromFirst: crossOffer(first.available, second.wanted),
    fromSecond: crossOffer(second.available, first.wanted),
  }
}
