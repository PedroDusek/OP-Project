import {
  deducibleReduction,
  totalAllocated,
  type Allocation,
  type Removal,
} from '@/server/domain/storage/allocation'
import type { TradeStatus } from '@/server/domain/trades/negotiation'

/**
 * A conclusão de uma troca: quando ela pode acontecer, e de onde as cartas saem.
 *
 * Camada: domain. Puro, síncrono, sem I/O.
 *
 * ## Confirmar não é ter trocado
 *
 * São dois fatos diferentes e a regra 4.5 os separa: `CONFIRMED` é "os dois
 * concordam com esta troca", `COMPLETED` é "as cartas mudaram de dono". Entre um
 * e outro existe um encontro no mundo, que o sistema não vê acontecer — e é por
 * isso que `CONFIRMED` é estado de descanso e não passagem.
 *
 * **Os dois marcam** (decisão 062). Ninguém tem a coleção mexida sem o próprio
 * gesto, e é o único arranjo em que cada um responde, pelas próprias cópias, a
 * pergunta da regra 4.6.
 *
 * ## De onde as cópias saem
 *
 * Da mesma regra 3.3, aplicada aos locais de troca: deduzir quando a resposta é
 * única, perguntar quando há escolha real (regra 4.6). Quem faz a dedução é
 * `deducibleReduction`, a mesma função que a coleção usa — reusá-la não é
 * economia, é o que garante que os dois lugares respondam igual. O dia em que
 * divergirem, "de onde sai esta carta" teria duas respostas dependendo da tela.
 */

/** Onde uma pessoa está no gesto de concluir. */
export interface ExchangeMark {
  userId: bigint
  /** Quando esta pessoa marcou que as cartas trocaram de mão. Nulo se não marcou. */
  exchangedAt: Date | null
}

/**
 * A troca só pode ser marcada como feita quando está confirmada.
 *
 * Nem antes — marcar uma troca que ainda se negocia diria "trocamos" sobre um
 * combinado que ninguém fechou — nem depois, porque `COMPLETED` já é o fim e
 * `CANCELLED` não tem o que concluir.
 */
export function canMarkExchange(status: TradeStatus): boolean {
  return status === 'CONFIRMED'
}

/**
 * Os dois marcaram: a troca aconteceu de verdade.
 *
 * "Os dois", e não "todos", pela mesma razão de `isValidated`: um trade efetivo
 * tem exatamente dois participantes (regra 4.5), e uma marcação sozinha é
 * metade de um fato.
 */
export function bothMarkedExchange(participants: readonly ExchangeMark[]): boolean {
  return participants.length === 2 && participants.every((p) => p.exchangedAt !== null)
}

/** Por que uma origem não fecha. Cada motivo vira uma frase diferente na tela. */
export type OriginProblem =
  /** Cópias espalhadas em mais de um local de troca, e a troca leva só parte. */
  | 'ESCOLHA_NECESSARIA'
  /** A pessoa não tem mais tantas cópias disponíveis para troca (regra 4.7, item 4). */
  | 'INDISPONIVEL'
  | 'NEGATIVA'
  | 'LOCAL_DESCONHECIDO'
  | 'ALEM_DO_ALOCADO'
  /** A escolha não soma exatamente o que está sendo oferecido. */
  | 'SOMA_DIFERENTE'

export type OriginPlan =
  | { ok: true; removals: Removal[] }
  | { ok: false; reason: OriginProblem }

/**
 * De quais locais de troca saem as cópias de uma carta oferecida.
 *
 * Sem escolha vinda de fora, tenta deduzir; só o que não se deduz vira pergunta.
 * Com escolha, confere se ela fecha a conta.
 *
 * ## Por que não é `planReduction`
 *
 * A função irmã, que a coleção usa, **permite retirar a mais**: quem está
 * resolvendo um conflito da decisão 007 pode aproveitar e desalocar por vontade
 * própria, e a invariante continua de pé. Aqui isso seria mentira. As cópias que
 * saem do local são exatamente as que mudaram de dono; retirar uma a mais
 * registraria que uma carta saiu do binder quando ela continua lá.
 *
 * Por isso a soma tem de bater exata, e `SOMA_DIFERENTE` cobre os dois lados —
 * de menos deixaria alocação órfã, de mais apagaria uma cópia que ninguém moveu.
 */
export function planOrigin(
  offered: number,
  allocations: readonly Allocation[],
  chosen: readonly Removal[] = [],
): OriginPlan {
  const available = totalAllocated(allocations)

  // Regra 4.7, item 4: toda quantidade oferecida está de fato disponível. Vale
  // na hora de marcar e de novo na de concluir, porque entre as duas a pessoa
  // pode ter tirado a carta do binder de troca.
  if (offered > available) return { ok: false, reason: 'INDISPONIVEL' }

  if (chosen.length === 0) {
    const deduced = deducibleReduction(available - offered, allocations)
    return deduced === null
      ? { ok: false, reason: 'ESCOLHA_NECESSARIA' }
      : { ok: true, removals: deduced }
  }

  const held = new Map(allocations.map((a) => [a.storageLocationId, a.quantity]))
  const merged = new Map<string, number>()

  for (const removal of chosen) {
    if (!Number.isInteger(removal.quantity) || removal.quantity <= 0) {
      return { ok: false, reason: 'NEGATIVA' }
    }

    const there = held.get(removal.storageLocationId)
    if (there === undefined) return { ok: false, reason: 'LOCAL_DESCONHECIDO' }

    const accumulated = (merged.get(removal.storageLocationId) ?? 0) + removal.quantity
    if (accumulated > there) return { ok: false, reason: 'ALEM_DO_ALOCADO' }
    merged.set(removal.storageLocationId, accumulated)
  }

  let total = 0
  for (const quantity of merged.values()) total += quantity
  if (total !== offered) return { ok: false, reason: 'SOMA_DIFERENTE' }

  return {
    ok: true,
    removals: [...merged].map(([storageLocationId, quantity]) => ({
      storageLocationId,
      quantity,
    })),
  }
}

/**
 * Esta carta precisa que a pessoa diga de onde as cópias saem?
 *
 * Serve à tela, que precisa saber quais perguntas fazer **antes** de deixar
 * marcar. Perguntar depois, com a marcação já dada, seria pedir para confirmar
 * um gesto que a pessoa acha que já fez.
 */
export function needsOriginChoice(
  offered: number,
  allocations: readonly Allocation[],
): boolean {
  const plan = planOrigin(offered, allocations)
  return !plan.ok && plan.reason === 'ESCOLHA_NECESSARIA'
}

/** Uma carta e quantas cópias dela, de um dos lados da troca. */
export interface OfferedCard {
  variantId: string
  quantity: number
}

/** O quanto a coleção de uma pessoa muda, para uma carta. */
export interface CollectionDelta {
  variantId: string
  /** Negativo entrega, positivo recebe. Nunca zero: zero não é mudança. */
  delta: number
}

/**
 * O saldo da troca na coleção de uma pessoa, carta a carta.
 *
 * Existe por causa de um caso que parece raro e não é: **a mesma carta nos dois
 * lados**. Trocar duas Nami por uma Nami de outra arte não acontece, mas trocar
 * duas cópias e receber uma de volta como parte do acerto acontece — e tratar
 * isso como duas escritas separadas passaria por um estado intermediário onde a
 * pessoa tem menos cópias do que tem alocado, que é justamente o que o trigger
 * do banco recusa.
 *
 * Somando antes, a coleção anda uma vez só e nunca visita um estado inválido.
 *
 * As **alocações** não entram nesta conta: do local de troca saem todas as
 * cópias entregues, e não o saldo. Quem recebe volta sem lugar registrado, que
 * a regra 3.2 diz ser normal e esperado.
 */
export function collectionDeltas(
  given: readonly OfferedCard[],
  received: readonly OfferedCard[],
): CollectionDelta[] {
  const byVariant = new Map<string, number>()

  for (const card of given) {
    byVariant.set(card.variantId, (byVariant.get(card.variantId) ?? 0) - card.quantity)
  }
  for (const card of received) {
    byVariant.set(card.variantId, (byVariant.get(card.variantId) ?? 0) + card.quantity)
  }

  return [...byVariant]
    .filter(([, delta]) => delta !== 0)
    .map(([variantId, delta]) => ({ variantId, delta }))
}
