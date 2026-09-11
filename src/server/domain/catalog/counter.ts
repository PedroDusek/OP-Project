/**
 * O filtro de counter.
 *
 * Camada: domain. Puro, sem I/O.
 *
 * ## Três valores, e o zero é o ausente
 *
 * No jogo, counter é atributo de **personagem**: +1000, +2000, ou nenhum. O
 * catálogo importado confirma exatamente isso — medido em 10/09/2026, só existem
 * 1000 e 2000, e todo personagem sem counter está como vazio, porque a fonte
 * publica um `-` e o importador lê como nulo.
 *
 * Por isso "counter 0" não é `counter = 0`, que não casaria com carta nenhuma: é
 * **personagem sem counter**. Os 488 que existem são reais, e não falha de
 * importação — concentram-se nos custos altos, e os de custo baixo batem com o
 * jogo (o ST01-004 Sanji não tem counter).
 *
 * ## Com qualquer valor marcado, só personagem
 *
 * Escolha do dono do produto. Eventos, Leaders e Stages também não têm counter,
 * mas não por serem "counter 0" — eles simplesmente não têm o atributo. Quem
 * filtra por counter está montando a curva de counter do deck, e para essa
 * pergunta um evento no resultado é ruído.
 *
 * Fica coerente com +1000 e +2000, que só existem em personagem: qualquer opção
 * marcada, o filtro fala só de personagens.
 */

/** Os valores que o filtro aceita, na ordem em que aparecem na tela. */
export const COUNTER_VALUES = [0, 1000, 2000] as const

export type CounterValue = (typeof COUNTER_VALUES)[number]

/**
 * Os mesmos valores, como chegam na URL e na API.
 *
 * Separado de `COUNTER_VALUES` porque o schema da API precisa de uma tupla de
 * strings literal para validar. Um teste garante que as duas listas não
 * divergem — se divergirem, um valor aceito na tela seria recusado pela API, ou
 * o contrário.
 */
export const COUNTER_TOKENS = ['0', '1000', '2000'] as const

export type CounterToken = (typeof COUNTER_TOKENS)[number]

/** O rótulo de cada valor. O zero fica "0", que é como quem joga fala. */
export const COUNTER_LABELS: Record<CounterToken, string> = {
  '0': '0',
  '1000': '+1000',
  '2000': '+2000',
}

/**
 * Lê um valor vindo de fora, ou `undefined` quando não é um dos três.
 *
 * Valor desconhecido vira ausência, e não erro nem zero: uma URL editada à mão
 * com `contador=500` não deve devolver personagens sem counter, que ninguém
 * pediu.
 */
export function parseCounterValue(raw: string): CounterValue | undefined {
  const trimmed = raw.trim()
  const index = (COUNTER_TOKENS as readonly string[]).indexOf(trimmed)
  return index === -1 ? undefined : COUNTER_VALUES[index]
}
