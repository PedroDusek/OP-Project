import { describe, expect, it } from 'vitest'
import {
  bothMarkedExchange,
  canMarkExchange,
  collectionDeltas,
  needsOriginChoice,
  planOrigin,
} from '@/server/domain/trades/completion'
import type { Allocation } from '@/server/domain/storage/allocation'

/**
 * A aritmetica de concluir uma troca, sem banco.
 *
 * O que se protege aqui e a regra 4.6 — de onde as copias saem — e a 4.5, que
 * separa "confirmada" de "concluida". O efeito no banco esta em
 * `tests/integration/trade-completion.test.ts`.
 */

const doisLocais: Allocation[] = [
  { storageLocationId: 'binder', quantity: 2 },
  { storageLocationId: 'caixa', quantity: 2 },
]

describe('quando a troca pode ser marcada como feita', () => {
  it('so quando esta confirmada pelos dois', () => {
    expect(canMarkExchange('CONFIRMED')).toBe(true)
  })

  /*
   * Marcar uma troca que ainda se negocia diria "trocamos" sobre um combinado
   * que ninguem fechou. E `COMPLETED` ja e o fim.
   */
  it('nao antes, e nao depois', () => {
    for (const status of ['DRAFT', 'PROPOSED', 'NEGOTIATING', 'COMPLETED', 'CANCELLED'] as const) {
      expect(canMarkExchange(status)).toBe(false)
    }
  })
})

describe('os dois marcam', () => {
  const marcou = { userId: 1n, exchangedAt: new Date() }
  const naoMarcou = { userId: 2n, exchangedAt: null }

  it('conclui quando os dois marcaram', () => {
    expect(bothMarkedExchange([marcou, { userId: 2n, exchangedAt: new Date() }])).toBe(true)
  })

  it('nao conclui com uma marcacao so', () => {
    expect(bothMarkedExchange([marcou, naoMarcou])).toBe(false)
  })

  /** Um trade efetivo tem exatamente dois participantes (regra 4.5). */
  it('nao conclui com uma pessoa so, mesmo que ela tenha marcado', () => {
    expect(bothMarkedExchange([marcou])).toBe(false)
  })
})

describe('de onde as copias saem', () => {
  it('deduz quando todas estao num local de troca so', () => {
    const plan = planOrigin(2, [{ storageLocationId: 'binder', quantity: 4 }])

    expect(plan).toEqual({ ok: true, removals: [{ storageLocationId: 'binder', quantity: 2 }] })
  })

  /*
   * Sai tudo: nao sobra copia nenhuma nos locais de troca, entao nao existe
   * segunda leitura possivel — e a decisao 049 diz para nao perguntar aqui.
   */
  it('deduz quando a troca leva tudo, mesmo espalhado', () => {
    const plan = planOrigin(4, doisLocais)

    expect(plan).toEqual({
      ok: true,
      removals: [
        { storageLocationId: 'binder', quantity: 2 },
        { storageLocationId: 'caixa', quantity: 2 },
      ],
    })
  })

  /** O caso da regra 4.6: espalhadas, e a troca leva so parte. */
  it('pergunta quando ha escolha real', () => {
    expect(planOrigin(2, doisLocais)).toEqual({ ok: false, reason: 'ESCOLHA_NECESSARIA' })
    expect(needsOriginChoice(2, doisLocais)).toBe(true)
  })

  it('nao pergunta quando nao ha escolha', () => {
    expect(needsOriginChoice(4, doisLocais)).toBe(false)
    expect(needsOriginChoice(1, [{ storageLocationId: 'binder', quantity: 3 }])).toBe(false)
  })

  /** Regra 4.7, item 4: o oferecido tem de estar disponivel. */
  it('recusa oferecer mais do que esta disponivel para troca', () => {
    expect(planOrigin(5, doisLocais)).toEqual({ ok: false, reason: 'INDISPONIVEL' })
  })

  it('aceita a escolha que fecha a conta', () => {
    const plan = planOrigin(2, doisLocais, [
      { storageLocationId: 'binder', quantity: 1 },
      { storageLocationId: 'caixa', quantity: 1 },
    ])

    expect(plan).toEqual({
      ok: true,
      removals: [
        { storageLocationId: 'binder', quantity: 1 },
        { storageLocationId: 'caixa', quantity: 1 },
      ],
    })
  })

  /*
   * A diferenca para `planReduction`, que a colecao usa: la retirar a mais e
   * escolha legitima de quem esta desalocando. Aqui seria mentira — as copias
   * que saem do local sao exatamente as que mudaram de dono.
   */
  it('recusa escolha que nao soma exatamente o que esta sendo trocado', () => {
    expect(planOrigin(2, doisLocais, [{ storageLocationId: 'binder', quantity: 1 }])).toEqual({
      ok: false,
      reason: 'SOMA_DIFERENTE',
    })

    expect(
      planOrigin(2, doisLocais, [
        { storageLocationId: 'binder', quantity: 2 },
        { storageLocationId: 'caixa', quantity: 1 },
      ]),
    ).toEqual({ ok: false, reason: 'SOMA_DIFERENTE' })
  })

  it('recusa local que nao guarda esta carta', () => {
    expect(planOrigin(2, doisLocais, [{ storageLocationId: 'deck', quantity: 2 }])).toEqual({
      ok: false,
      reason: 'LOCAL_DESCONHECIDO',
    })
  })

  it('recusa tirar de um local mais do que ha nele', () => {
    expect(planOrigin(2, doisLocais, [{ storageLocationId: 'binder', quantity: 3 }])).toEqual({
      ok: false,
      reason: 'ALEM_DO_ALOCADO',
    })
  })

  it('recusa retirada zerada ou negativa', () => {
    expect(planOrigin(2, doisLocais, [{ storageLocationId: 'binder', quantity: 0 }])).toEqual({
      ok: false,
      reason: 'NEGATIVA',
    })
    expect(planOrigin(2, doisLocais, [{ storageLocationId: 'binder', quantity: -1 }])).toEqual({
      ok: false,
      reason: 'NEGATIVA',
    })
  })

  it('nao tem o que planejar quando nada esta guardado e nada e oferecido', () => {
    expect(planOrigin(0, [])).toEqual({ ok: true, removals: [] })
  })
})

describe('o saldo da troca na colecao', () => {
  it('tira o que entrega e poe o que recebe', () => {
    const deltas = collectionDeltas(
      [{ variantId: '1', quantity: 2 }],
      [{ variantId: '2', quantity: 1 }],
    )

    expect(deltas).toEqual([
      { variantId: '1', delta: -2 },
      { variantId: '2', delta: 1 },
    ])
  })

  /*
   * O caso que existe para isto: a mesma carta nos dois lados. Tratado como duas
   * escritas, passaria por um estado com menos copias do que ha alocado — que e
   * o que o trigger do banco recusa.
   */
  it('soma os dois lados quando a carta e a mesma', () => {
    const deltas = collectionDeltas(
      [{ variantId: '1', quantity: 2 }],
      [{ variantId: '1', quantity: 1 }],
    )

    expect(deltas).toEqual([{ variantId: '1', delta: -1 }])
  })

  /** Saldo zero nao e mudanca, e escrever "some 0" so daria trabalho ao banco. */
  it('descarta a carta que entra e sai na mesma quantidade', () => {
    const deltas = collectionDeltas(
      [{ variantId: '1', quantity: 2 }],
      [{ variantId: '1', quantity: 2 }],
    )

    expect(deltas).toEqual([])
  })

  it('aceita uma troca de mao unica', () => {
    expect(collectionDeltas([{ variantId: '1', quantity: 1 }], [])).toEqual([
      { variantId: '1', delta: -1 },
    ])
    expect(collectionDeltas([], [{ variantId: '1', quantity: 1 }])).toEqual([
      { variantId: '1', delta: 1 },
    ])
  })
})
