import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { markExchange, withdrawExchange } from '@/server/application/trades/complete-trade'
import {
  confirmTrade,
  setOfferItem,
  withdrawConfirmation,
} from '@/server/application/trades/edit-offer'
import { joinTrade, startTrade } from '@/server/application/trades/start-trade'
import { ConflictError } from '@/server/domain/errors'
import type { AuthenticatedUser } from '@/server/application/auth'
import {
  allocate,
  createCardWithVariant,
  createStorage,
  createUser,
  disconnect,
  own,
  resetDatabase,
  testPrisma,
} from '../helpers'

/**
 * Concluir uma troca, contra o banco.
 *
 * A aritmetica esta em `tests/domain/trade-completion.test.ts`, sem banco. Aqui
 * se verifica o que so o banco pode dizer: que as duas colecoes andam juntas,
 * que as copias saem do local de troca certo, que nada acontece com uma
 * marcacao so, e que uma conclusao recusada nao deixa metade feita.
 */

type Person = { user: AuthenticatedUser; userId: bigint; collectionId: bigint }

async function person(name: string): Promise<Person> {
  const created = await createUser(name)
  return {
    userId: created.id,
    collectionId: created.collection!.id,
    user: {
      id: created.id,
      email: `${name.toLowerCase()}@example.test`,
      name,
      plan: 'FREE',
      premiumUntil: null,
    },
  }
}

/** Uma carta possuida e disponivel para troca, num binder de troca so. */
async function availableForTrade(who: Person, quantity: number, code?: string) {
  const { variant } = await createCardWithVariant('Character', code)
  const item = await own(who.collectionId, variant.id, quantity)
  const local = await createStorage(who.userId, 'BINDER', 'TRADE')
  await allocate(item.id, local.id, quantity)
  return { variant, item, local }
}

/** Uma troca ja confirmada pelos dois: o estado de onde a conclusao parte. */
async function confirmedTrade(a: Person, b: Person) {
  const { tradeId, inviteToken } = await startTrade(testPrisma(), a.user)
  await joinTrade(testPrisma(), b.user, inviteToken)
  return tradeId
}

async function confirmBoth(tradeId: bigint, a: Person, b: Person) {
  await confirmTrade(testPrisma(), a.user, tradeId)
  await confirmTrade(testPrisma(), b.user, tradeId)
}

async function quantityOf(collectionId: bigint, cardVariantId: bigint) {
  const item = await testPrisma().collectionItem.findUnique({
    where: { collectionId_cardVariantId: { collectionId, cardVariantId } },
    select: { quantity: true },
  })
  return item?.quantity ?? 0
}

async function allocatedIn(storageLocationId: bigint) {
  const rows = await testPrisma().collectionItemLocation.findMany({
    where: { storageLocationId },
    select: { quantity: true },
  })
  return rows.reduce((total, row) => total + row.quantity, 0)
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('os dois marcam, e so entao a troca acontece', () => {
  it('nao move nada com uma marcacao so', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const dela = await availableForTrade(ana, 2, 'OP01-101')
    const dele = await availableForTrade(bruno, 1, 'OP01-102')

    const tradeId = await confirmedTrade(ana, bruno)
    await setOfferItem(testPrisma(), ana.user, tradeId, {
      cardVariantId: dela.variant.id,
      quantity: 2,
    })
    await setOfferItem(testPrisma(), bruno.user, tradeId, {
      cardVariantId: dele.variant.id,
      quantity: 1,
    })
    await confirmBoth(tradeId, ana, bruno)

    const { completed } = await markExchange(testPrisma(), ana.user, tradeId)

    expect(completed).toBe(false)
    expect(await quantityOf(ana.collectionId, dela.variant.id)).toBe(2)
    expect(await quantityOf(bruno.collectionId, dele.variant.id)).toBe(1)

    const trade = await testPrisma().trade.findUniqueOrThrow({ where: { id: tradeId } })
    expect(trade.status).toBe('CONFIRMED')
    expect(trade.completedAt).toBeNull()
  })

  it('move as duas colecoes quando o segundo marca', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const dela = await availableForTrade(ana, 2, 'OP01-103')
    const dele = await availableForTrade(bruno, 1, 'OP01-104')

    const tradeId = await confirmedTrade(ana, bruno)
    await setOfferItem(testPrisma(), ana.user, tradeId, {
      cardVariantId: dela.variant.id,
      quantity: 2,
    })
    await setOfferItem(testPrisma(), bruno.user, tradeId, {
      cardVariantId: dele.variant.id,
      quantity: 1,
    })
    await confirmBoth(tradeId, ana, bruno)

    await markExchange(testPrisma(), ana.user, tradeId)
    const { completed } = await markExchange(testPrisma(), bruno.user, tradeId)

    expect(completed).toBe(true)

    // Quem entregou tudo sai da colecao: quantidade zero e a ausencia da linha.
    expect(await quantityOf(ana.collectionId, dela.variant.id)).toBe(0)
    expect(await quantityOf(bruno.collectionId, dele.variant.id)).toBe(0)

    // E recebe o que veio do outro lado.
    expect(await quantityOf(ana.collectionId, dele.variant.id)).toBe(1)
    expect(await quantityOf(bruno.collectionId, dela.variant.id)).toBe(2)

    // As copias entregues saem do binder de troca (regra 4.7, item 6).
    expect(await allocatedIn(dela.local.id)).toBe(0)
    expect(await allocatedIn(dele.local.id)).toBe(0)

    const trade = await testPrisma().trade.findUniqueOrThrow({ where: { id: tradeId } })
    expect(trade.status).toBe('COMPLETED')
    expect(trade.completedAt).not.toBeNull()
  })

  /*
   * Quem recebe volta sem lugar registrado. A regra 3.2 diz que copia sem
   * localizacao e normal e esperada, e nao existe local "sem lugar" para
   * inventar aqui.
   */
  it('poe o recebido na colecao sem local nenhum', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const dele = await availableForTrade(bruno, 1, 'OP01-105')

    const tradeId = await confirmedTrade(ana, bruno)
    await setOfferItem(testPrisma(), bruno.user, tradeId, {
      cardVariantId: dele.variant.id,
      quantity: 1,
    })
    await confirmBoth(tradeId, ana, bruno)
    await markExchange(testPrisma(), ana.user, tradeId)
    await markExchange(testPrisma(), bruno.user, tradeId)

    const recebido = await testPrisma().collectionItem.findUniqueOrThrow({
      where: {
        collectionId_cardVariantId: {
          collectionId: ana.collectionId,
          cardVariantId: dele.variant.id,
        },
      },
      select: { quantity: true, locations: true },
    })

    expect(recebido.quantity).toBe(1)
    expect(recebido.locations).toEqual([])
  })

  /*
   * A mesma carta nos dois lados. Aplicado como duas escritas separadas, isto
   * visitaria um estado com menos copias do que ha alocado, e o trigger do banco
   * recusaria.
   */
  it('anda uma vez so quando a mesma carta esta nos dois lados', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')

    const { variant } = await createCardWithVariant('Character', 'OP01-106')

    const itemAna = await own(ana.collectionId, variant.id, 2)
    const binderAna = await createStorage(ana.userId, 'BINDER', 'TRADE')
    await allocate(itemAna.id, binderAna.id, 2)

    const itemBruno = await own(bruno.collectionId, variant.id, 1)
    const binderBruno = await createStorage(bruno.userId, 'BINDER', 'TRADE')
    await allocate(itemBruno.id, binderBruno.id, 1)

    const tradeId = await confirmedTrade(ana, bruno)
    await setOfferItem(testPrisma(), ana.user, tradeId, {
      cardVariantId: variant.id,
      quantity: 2,
    })
    await setOfferItem(testPrisma(), bruno.user, tradeId, {
      cardVariantId: variant.id,
      quantity: 1,
    })
    await confirmBoth(tradeId, ana, bruno)
    await markExchange(testPrisma(), ana.user, tradeId)
    await markExchange(testPrisma(), bruno.user, tradeId)

    // Ana entregou 2 e recebeu 1: fica com 1. Bruno entregou 1 e recebeu 2.
    expect(await quantityOf(ana.collectionId, variant.id)).toBe(1)
    expect(await quantityOf(bruno.collectionId, variant.id)).toBe(2)

    // As copias entregues sairam dos binders de troca, e as recebidas nao
    // entraram em lugar nenhum.
    expect(await allocatedIn(binderAna.id)).toBe(0)
    expect(await allocatedIn(binderBruno.id)).toBe(0)
  })
})

describe('marcar tem hora', () => {
  it('recusa marcar antes de os dois confirmarem', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const dela = await availableForTrade(ana, 1, 'OP01-107')

    const tradeId = await confirmedTrade(ana, bruno)
    await setOfferItem(testPrisma(), ana.user, tradeId, {
      cardVariantId: dela.variant.id,
      quantity: 1,
    })
    await confirmTrade(testPrisma(), ana.user, tradeId)

    await expect(markExchange(testPrisma(), ana.user, tradeId)).rejects.toThrow(
      /confirmada pelos dois/i,
    )
  })

  it('recusa quem nao participa', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const estranho = await person('Estranho')

    const tradeId = await confirmedTrade(ana, bruno)
    await expect(markExchange(testPrisma(), estranho.user, tradeId)).rejects.toThrow(
      /não participa/i,
    )
  })
})

describe('a marcacao cai com o combinado', () => {
  /** Regra 4.6.3, estendida a marcacao pela decisao 062. */
  it('alterar a oferta derruba as marcacoes dos dois', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const dela = await availableForTrade(ana, 2, 'OP01-108')

    const tradeId = await confirmedTrade(ana, bruno)
    await setOfferItem(testPrisma(), ana.user, tradeId, {
      cardVariantId: dela.variant.id,
      quantity: 1,
    })
    await confirmBoth(tradeId, ana, bruno)
    await markExchange(testPrisma(), ana.user, tradeId)

    await setOfferItem(testPrisma(), ana.user, tradeId, {
      cardVariantId: dela.variant.id,
      quantity: 2,
    })

    const marcas = await testPrisma().tradeParticipant.findMany({
      where: { tradeId },
      select: { exchangedAt: true, confirmedAt: true },
    })
    expect(marcas.every((m) => m.exchangedAt === null)).toBe(true)
    expect(marcas.every((m) => m.confirmedAt === null)).toBe(true)

    // A origem guardada descrevia a oferta anterior, e vai junto.
    expect(await testPrisma().tradeItemOrigin.count()).toBe(0)
  })

  /*
   * Sem isto, retirar a confirmacao e confirmar de novo concluiria a troca no
   * mesmo instante, usando a marcacao que o outro deu para um combinado que
   * acabou de ser desfeito e refeito.
   */
  it('retirar a confirmacao derruba as marcacoes dos dois', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const dela = await availableForTrade(ana, 1, 'OP01-109')

    const tradeId = await confirmedTrade(ana, bruno)
    await setOfferItem(testPrisma(), ana.user, tradeId, {
      cardVariantId: dela.variant.id,
      quantity: 1,
    })
    await confirmBoth(tradeId, ana, bruno)
    await markExchange(testPrisma(), bruno.user, tradeId)

    await withdrawConfirmation(testPrisma(), ana.user, tradeId)

    const marcas = await testPrisma().tradeParticipant.findMany({
      where: { tradeId },
      select: { exchangedAt: true },
    })
    expect(marcas.every((m) => m.exchangedAt === null)).toBe(true)
  })

  it('deixa retirar a propria marcacao sem desfazer a confirmacao', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const dela = await availableForTrade(ana, 1, 'OP01-110')

    const tradeId = await confirmedTrade(ana, bruno)
    await setOfferItem(testPrisma(), ana.user, tradeId, {
      cardVariantId: dela.variant.id,
      quantity: 1,
    })
    await confirmBoth(tradeId, ana, bruno)
    await markExchange(testPrisma(), ana.user, tradeId)
    await withdrawExchange(testPrisma(), ana.user, tradeId)

    const minha = await testPrisma().tradeParticipant.findFirstOrThrow({
      where: { tradeId, userId: ana.userId },
      select: { exchangedAt: true, confirmedAt: true },
    })

    expect(minha.exchangedAt).toBeNull()
    expect(minha.confirmedAt).not.toBeNull()

    const trade = await testPrisma().trade.findUniqueOrThrow({ where: { id: tradeId } })
    expect(trade.status).toBe('CONFIRMED')
  })
})

describe('de onde as copias saem', () => {
  /** O caso da regra 4.6: espalhadas em dois locais, e a troca leva so parte. */
  it('pergunta quando ha escolha real, e nao marca nada', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')

    const { variant } = await createCardWithVariant('Character', 'OP01-111')
    const item = await own(ana.collectionId, variant.id, 4)
    const binder = await createStorage(ana.userId, 'BINDER', 'TRADE', 'Binder de troca')
    const caixa = await createStorage(ana.userId, 'BOX', 'TRADE', 'Caixa de troca')
    await allocate(item.id, binder.id, 2)
    await allocate(item.id, caixa.id, 2)

    const tradeId = await confirmedTrade(ana, bruno)
    await setOfferItem(testPrisma(), ana.user, tradeId, {
      cardVariantId: variant.id,
      quantity: 2,
    })
    await confirmBoth(tradeId, ana, bruno)

    const erro = await markExchange(testPrisma(), ana.user, tradeId).catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(ConflictError)
    const conflito = erro as ConflictError
    expect(conflito.code).toBe('ORIGEM_A_ESCOLHER')

    const detalhes = conflito.details as {
      cards: { cardCode: string; offered: number; locations: { storageName: string }[] }[]
    }
    expect(detalhes.cards).toHaveLength(1)
    expect(detalhes.cards[0].offered).toBe(2)
    expect(detalhes.cards[0].locations.map((l) => l.storageName).sort()).toEqual([
      'Binder de troca',
      'Caixa de troca',
    ])

    const minha = await testPrisma().tradeParticipant.findFirstOrThrow({
      where: { tradeId, userId: ana.userId },
      select: { exchangedAt: true },
    })
    expect(minha.exchangedAt).toBeNull()
  })

  it('aceita a escolha e tira de onde a pessoa disse', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')

    const { variant } = await createCardWithVariant('Character', 'OP01-112')
    const item = await own(ana.collectionId, variant.id, 4)
    const binder = await createStorage(ana.userId, 'BINDER', 'TRADE', 'Binder de troca')
    const caixa = await createStorage(ana.userId, 'BOX', 'TRADE', 'Caixa de troca')
    await allocate(item.id, binder.id, 2)
    await allocate(item.id, caixa.id, 2)

    const tradeId = await confirmedTrade(ana, bruno)
    await setOfferItem(testPrisma(), ana.user, tradeId, {
      cardVariantId: variant.id,
      quantity: 2,
    })
    await confirmBoth(tradeId, ana, bruno)

    await markExchange(testPrisma(), ana.user, tradeId, [
      {
        cardVariantId: variant.id,
        removals: [{ storageLocationId: String(caixa.id), quantity: 2 }],
      },
    ])
    await markExchange(testPrisma(), bruno.user, tradeId)

    expect(await quantityOf(ana.collectionId, variant.id)).toBe(2)
    // Saiu inteiro da caixa, que foi o que ela disse; o binder ficou intacto.
    expect(await allocatedIn(caixa.id)).toBe(0)
    expect(await allocatedIn(binder.id)).toBe(2)
  })

  it('recusa escolha que nao soma o que esta sendo trocado', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')

    const { variant } = await createCardWithVariant('Character', 'OP01-113')
    const item = await own(ana.collectionId, variant.id, 4)
    const binder = await createStorage(ana.userId, 'BINDER', 'TRADE')
    const caixa = await createStorage(ana.userId, 'BOX', 'TRADE')
    await allocate(item.id, binder.id, 2)
    await allocate(item.id, caixa.id, 2)

    const tradeId = await confirmedTrade(ana, bruno)
    await setOfferItem(testPrisma(), ana.user, tradeId, {
      cardVariantId: variant.id,
      quantity: 2,
    })
    await confirmBoth(tradeId, ana, bruno)

    await expect(
      markExchange(testPrisma(), ana.user, tradeId, [
        {
          cardVariantId: variant.id,
          removals: [{ storageLocationId: String(caixa.id), quantity: 1 }],
        },
      ]),
    ).rejects.toThrow(/somar exatamente/i)
  })

  /*
   * So `purpose = 'TRADE'` conta (regra 4.1). Uma copia guardada num binder de
   * colecao continua integralmente na colecao e nao e o que se oferece.
   */
  it('nao tira de armazenamento de colecao', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')

    const { variant } = await createCardWithVariant('Character', 'OP01-114')
    const item = await own(ana.collectionId, variant.id, 2)
    const guardado = await createStorage(ana.userId, 'BINDER', 'COLLECTION')
    await allocate(item.id, guardado.id, 2)

    const tradeId = await confirmedTrade(ana, bruno)
    await setOfferItem(testPrisma(), ana.user, tradeId, {
      cardVariantId: variant.id,
      quantity: 1,
    })
    await confirmBoth(tradeId, ana, bruno)

    await expect(markExchange(testPrisma(), ana.user, tradeId)).rejects.toThrow(
      /disponíveis para troca/i,
    )
    expect(await allocatedIn(guardado.id)).toBe(2)
  })
})

describe('uma conclusao recusada nao deixa metade feita', () => {
  /*
   * Regra 4.7: se qualquer etapa falha, a transacao inteira sofre rollback. O
   * caso concreto e a pessoa tirar a carta do binder de troca entre marcar e o
   * outro marcar.
   */
  it('recusa e nao move nada quando a oferta perdeu lastro', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const dela = await availableForTrade(ana, 2, 'OP01-115')
    const dele = await availableForTrade(bruno, 1, 'OP01-116')

    const tradeId = await confirmedTrade(ana, bruno)
    await setOfferItem(testPrisma(), ana.user, tradeId, {
      cardVariantId: dela.variant.id,
      quantity: 2,
    })
    await setOfferItem(testPrisma(), bruno.user, tradeId, {
      cardVariantId: dele.variant.id,
      quantity: 1,
    })
    await confirmBoth(tradeId, ana, bruno)
    await markExchange(testPrisma(), ana.user, tradeId)

    // Entre uma marcacao e outra, Ana tira as copias do binder de troca.
    await testPrisma().collectionItemLocation.deleteMany({
      where: { storageLocationId: dela.local.id },
    })

    await expect(markExchange(testPrisma(), bruno.user, tradeId)).rejects.toThrow(
      /disponíveis para troca|não tem mais/i,
    )

    // Nada de Bruno se moveu, e a troca continua confirmada.
    expect(await quantityOf(bruno.collectionId, dele.variant.id)).toBe(1)
    expect(await allocatedIn(dele.local.id)).toBe(1)
    expect(await quantityOf(ana.collectionId, dele.variant.id)).toBe(0)

    const trade = await testPrisma().trade.findUniqueOrThrow({ where: { id: tradeId } })
    expect(trade.status).toBe('CONFIRMED')
    expect(trade.completedAt).toBeNull()
  })

  it('recusa concluir uma troca sem nenhum item', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')

    const tradeId = await confirmedTrade(ana, bruno)
    await confirmBoth(tradeId, ana, bruno)
    await markExchange(testPrisma(), ana.user, tradeId)

    await expect(markExchange(testPrisma(), bruno.user, tradeId)).rejects.toThrow(
      /nada para trocar/i,
    )

    const trade = await testPrisma().trade.findUniqueOrThrow({ where: { id: tradeId } })
    expect(trade.status).toBe('CONFIRMED')
  })
})
