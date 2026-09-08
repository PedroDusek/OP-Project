/**
 * A aritmética da alocação.
 *
 * Camada: domain. Puro, sem I/O.
 *
 * A invariante de `business-rules.md` 3.2 é uma só:
 *
 *     SUM(alocado) <= possuído
 *
 * Ela vale em dois sentidos, e é fácil lembrar só de um. Alocar demais a
 * quebra pela ponta de cima; **reduzir o que se possui** a quebra pela ponta de
 * baixo, e é esse segundo caso que a decisão 007 trata.
 *
 * A soma pode ser **menor** que o possuído: cópias sem local registrado são
 * normais. Não existe local "sem lugar" (`business-rules.md` 3.2), e por isso
 * nada aqui tenta inventar um.
 */

export interface Allocation {
  storageLocationId: string
  quantity: number
}

/** Quantas cópias sair de qual local, na resolução da decisão 007. */
export interface Removal {
  storageLocationId: string
  quantity: number
}

export function totalAllocated(allocations: readonly Allocation[]): number {
  return allocations.reduce((sum, allocation) => sum + allocation.quantity, 0)
}

/**
 * Cópias que a pessoa tem e não registrou em lugar nenhum.
 *
 * Nunca negativo: se o banco alguma vez tiver mais alocado que possuído — o que
 * três triggers existem para impedir —, a tela mostra zero em vez de um número
 * negativo que ninguém sabe ler.
 */
export function unallocatedCopies(owned: number, allocations: readonly Allocation[]): number {
  return Math.max(0, owned - totalAllocated(allocations))
}

/** Quanto ainda cabe num local, dado o que já está alocado nos outros. */
export function roomFor(
  owned: number,
  allocations: readonly Allocation[],
  storageLocationId: string,
): number {
  const elsewhere = allocations
    .filter((allocation) => allocation.storageLocationId !== storageLocationId)
    .reduce((sum, allocation) => sum + allocation.quantity, 0)
  return Math.max(0, owned - elsewhere)
}

export type ReductionPlan =
  | { ok: true; removals: Removal[] }
  | {
      ok: false
      /** Por que a resolução não fecha. Cada motivo vira uma frase diferente. */
      reason: 'NEGATIVA' | 'LOCAL_DESCONHECIDO' | 'ALEM_DO_ALOCADO' | 'INSUFICIENTE'
      /** Quantas cópias ainda precisam sair. Só em `INSUFICIENTE`. */
      missing?: number
    }

/**
 * Confere a resolução que o usuário mandou junto com a nova quantidade.
 *
 * O que se verifica, em ordem, é o que dá para errar:
 *
 *   - retirada negativa ou zero — pedido sem efeito, provavelmente engano;
 *   - local que não guarda essa carta — a tela mandou um id que não é dali;
 *   - retirar mais do que há naquele local — a tela ficou velha;
 *   - retirar de menos — sobra alocação órfã, que é justamente o que a decisão
 *     007 existe para impedir.
 *
 * Retirar **a mais** é permitido: desalocar por vontade própria enquanto
 * resolve o conflito é uma escolha legítima, e a invariante continua de pé.
 *
 * Nenhuma ordem de remoção é presumida. Se a pessoa não disser de onde as
 * cópias saem, nada sai (`business-rules.md` 3.3).
 */
export function planReduction(
  targetQuantity: number,
  allocations: readonly Allocation[],
  removals: readonly Removal[],
): ReductionPlan {
  const byLocation = new Map(allocations.map((a) => [a.storageLocationId, a.quantity]))
  const merged = new Map<string, number>()

  for (const removal of removals) {
    if (!Number.isInteger(removal.quantity) || removal.quantity <= 0) {
      return { ok: false, reason: 'NEGATIVA' }
    }
    const held = byLocation.get(removal.storageLocationId)
    if (held === undefined) return { ok: false, reason: 'LOCAL_DESCONHECIDO' }

    const accumulated = (merged.get(removal.storageLocationId) ?? 0) + removal.quantity
    if (accumulated > held) return { ok: false, reason: 'ALEM_DO_ALOCADO' }
    merged.set(removal.storageLocationId, accumulated)
  }

  const remaining = totalAllocated(allocations) - sum(merged.values())
  if (remaining > targetQuantity) {
    return { ok: false, reason: 'INSUFICIENTE', missing: remaining - targetQuantity }
  }

  return {
    ok: true,
    removals: [...merged].map(([storageLocationId, quantity]) => ({
      storageLocationId,
      quantity,
    })),
  }
}

function sum(values: Iterable<number>): number {
  let total = 0
  for (const value of values) total += value
  return total
}

/**
 * A retirada que nao precisa ser perguntada, ou `null` quando ha escolha real.
 *
 * A regra 3.3 existe para nao **presumir** de onde as copias saem. Mas presumir
 * so faz sentido quando ha mais de uma resposta possivel — e em dois casos nao
 * ha:
 *
 *   - **Sair da colecao inteira.** Se nao sobra nenhuma copia, todas as
 *     alocacoes vao junto. Nao existe outra leitura, e perguntar seria pedir
 *     para a pessoa confirmar a unica saida possivel. Foi o que aconteceu no
 *     primeiro uso real: pedir para remover e receber uma pergunta.
 *   - **Um local so.** Se todas as copias guardadas estao no mesmo lugar, e de
 *     la que elas saem.
 *
 * Com dois ou mais locais e uma reducao parcial, a escolha e real — tirar duas
 * do binder ou uma de cada sao resultados diferentes — e ai a pergunta volta.
 */
export function deducibleReduction(
  targetQuantity: number,
  allocations: readonly Allocation[],
): Removal[] | null {
  const allocated = totalAllocated(allocations)
  const excess = allocated - Math.max(0, targetQuantity)

  // Nada a retirar: o que esta guardado ja cabe no que vai sobrar.
  if (excess <= 0) return []

  // Sai tudo: a unica leitura possivel.
  if (targetQuantity <= 0) {
    return allocations
      .filter((allocation) => allocation.quantity > 0)
      .map((allocation) => ({ ...allocation }))
  }

  const holding = allocations.filter((allocation) => allocation.quantity > 0)
  if (holding.length === 1) {
    return [{ storageLocationId: holding[0].storageLocationId, quantity: excess }]
  }

  return null
}
