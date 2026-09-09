import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  cancelTrade,
  confirmTrade,
  setOfferItem,
  withdrawConfirmation,
} from '@/server/application/trades/edit-offer'
import { getTrade } from '@/server/application/trades/read-trade'
import { joinTrade, startTrade } from '@/server/application/trades/start-trade'
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
 * A negociacao de uma troca contra o banco.
 *
 * A aritmetica esta em `tests/domain/trade-crossing.test.ts` e
 * `trade-negotiation.test.ts`, sem banco. Aqui se verifica o que so o banco
 * pode dizer: que ninguem de fora le a troca, que ninguem mexe na oferta
 * alheia, e que a revogacao acontece junto com a alteracao.
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

/** Poe uma carta disponivel para troca, e devolve a variante. */
async function availableForTrade(who: Person, quantity: number) {
  const { variant } = await createCardWithVariant()
  const item = await own(who.collectionId, variant.id, quantity)
  const local = await createStorage(who.userId, 'BINDER', 'TRADE')
  await allocate(item.id, local.id, quantity)
  return variant
}

async function wants(who: Person, cardVariantId: bigint, quantity: number) {
  await testPrisma().wantItem.create({
    data: { userId: who.userId, cardVariantId, quantity },
  })
}

/** Uma troca com os dois lados dentro, que e o estado normal de trabalho. */
async function tradeBetween(a: Person, b: Person) {
  const { tradeId, inviteToken } = await startTrade(testPrisma(), a.user)
  await joinTrade(testPrisma(), b.user, inviteToken)
  return tradeId
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('comecar e entrar', () => {
  it('abre em rascunho, com um convite e uma pessoa', async () => {
    const ana = await person('Ana')

    const { tradeId, inviteToken } = await startTrade(testPrisma(), ana.user)
    const view = await getTrade(testPrisma(), ana.user, tradeId)

    expect(inviteToken).toHaveLength(32)
    expect(view).toMatchObject({ status: 'DRAFT', inviteToken })
    expect(view.other).toBeNull()
  })

  /** E aqui que o consentimento fecha (regra 4.6.1). */
  it('a segunda pessoa entra pelo convite e a troca vai a negociacao', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')

    const { tradeId, inviteToken } = await startTrade(testPrisma(), ana.user)
    await joinTrade(testPrisma(), bruno.user, inviteToken)

    const view = await getTrade(testPrisma(), ana.user, tradeId)
    expect(view.status).toBe('NEGOTIATING')
    expect(view.other?.name).toBe('Bruno')
  })

  /** Um link que continua valendo e um link que ainda pode vazar. */
  it('queima o convite quando alguem entra', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const carla = await person('Carla')

    const { tradeId, inviteToken } = await startTrade(testPrisma(), ana.user)
    await joinTrade(testPrisma(), bruno.user, inviteToken)

    await expect(joinTrade(testPrisma(), carla.user, inviteToken)).rejects.toThrow(
      /convite não vale mais/i,
    )
    expect((await getTrade(testPrisma(), ana.user, tradeId)).inviteToken).toBeNull()
  })

  it('recusa quem tenta entrar na propria troca', async () => {
    const ana = await person('Ana')
    const { inviteToken } = await startTrade(testPrisma(), ana.user)

    await expect(joinTrade(testPrisma(), ana.user, inviteToken)).rejects.toThrow(
      /já está nesta troca/i,
    )
  })

  it('recusa convite que nao existe', async () => {
    const ana = await person('Ana')

    await expect(joinTrade(testPrisma(), ana.user, 'inventado')).rejects.toThrow(
      /convite não vale mais/i,
    )
  })

  /** Regra 4.5: e o que impede as mesmas copias em varias trocas. */
  it('recusa uma segunda troca ativa', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    await tradeBetween(ana, bruno)

    await expect(startTrade(testPrisma(), ana.user)).rejects.toThrow(/troca em andamento/i)
  })

  /** Rascunho nao prende nada: e um convite que ninguem aceitou. */
  it('nao trava a pessoa por um convite pendente', async () => {
    const ana = await person('Ana')
    await startTrade(testPrisma(), ana.user)

    await expect(startTrade(testPrisma(), ana.user)).resolves.toBeTruthy()
  })
})

describe('ninguem de fora le', () => {
  /** Regra 6.2, e e ela que sustenta a promessa da 4.6.1. */
  it('recusa quem nao participa', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const carla = await person('Carla')
    const tradeId = await tradeBetween(ana, bruno)

    await expect(getTrade(testPrisma(), carla.user, tradeId)).rejects.toThrow(
      /não participa/i,
    )
  })

  it('recusa alteracao de quem nao participa', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const carla = await person('Carla')
    const tradeId = await tradeBetween(ana, bruno)
    const variant = await availableForTrade(ana, 2)

    await expect(
      setOfferItem(testPrisma(), carla.user, tradeId, {
        cardVariantId: variant.id,
        quantity: 1,
      }),
    ).rejects.toThrow(/não participa/i)
  })
})

describe('o cruzamento nas duas direcoes', () => {
  it('mostra o que cada um tem do interesse do outro', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')

    const daAna = await availableForTrade(ana, 3)
    const doBruno = await availableForTrade(bruno, 2)
    await wants(bruno, daAna.id, 4)
    await wants(ana, doBruno.id, 1)

    const tradeId = await tradeBetween(ana, bruno)
    const view = await getTrade(testPrisma(), ana.user, tradeId)

    expect(view.iCanOffer).toEqual([
      { variantId: String(daAna.id), quantity: 3, available: 3, stillWanted: 4 },
    ])
    expect(view.theyCanOffer).toEqual([
      { variantId: String(doBruno.id), quantity: 1, available: 2, stillWanted: 1 },
    ])
  })

  /** A tela e sempre "eu" e "a outra pessoa", nunca participante 1 e 2. */
  it('inverte a orientacao conforme quem le', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const daAna = await availableForTrade(ana, 3)
    await wants(bruno, daAna.id, 4)

    const tradeId = await tradeBetween(ana, bruno)
    const paraAna = await getTrade(testPrisma(), ana.user, tradeId)
    const paraBruno = await getTrade(testPrisma(), bruno.user, tradeId)

    expect(paraAna.iCanOffer).toEqual(paraBruno.theyCanOffer)
    expect(paraAna.theyCanOffer).toEqual(paraBruno.iCanOffer)
  })

  /** Antes de alguem entrar, nenhum dado privado e cruzado. */
  it('nao cruza nada enquanto falta a segunda pessoa', async () => {
    const ana = await person('Ana')
    await availableForTrade(ana, 3)

    const { tradeId } = await startTrade(testPrisma(), ana.user)
    const view = await getTrade(testPrisma(), ana.user, tradeId)

    expect(view.iCanOffer).toEqual([])
    expect(view.theyCanOffer).toEqual([])
  })
})

describe('cada um mexe so na propria oferta', () => {
  it('poe a carta na oferta de quem chamou', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const tradeId = await tradeBetween(ana, bruno)
    const variant = await availableForTrade(ana, 3)

    await setOfferItem(testPrisma(), ana.user, tradeId, {
      cardVariantId: variant.id,
      quantity: 2,
    })

    const paraAna = await getTrade(testPrisma(), ana.user, tradeId)
    expect(paraAna.me.offer).toHaveLength(1)
    expect(paraAna.me.offer[0]).toMatchObject({ quantity: 2 })
    expect(paraAna.other?.offer).toEqual([])
  })

  it('a oferta de um aparece como a do outro para o outro', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const tradeId = await tradeBetween(ana, bruno)
    const variant = await availableForTrade(ana, 3)

    await setOfferItem(testPrisma(), ana.user, tradeId, {
      cardVariantId: variant.id,
      quantity: 2,
    })

    const paraBruno = await getTrade(testPrisma(), bruno.user, tradeId)
    expect(paraBruno.me.offer).toEqual([])
    expect(paraBruno.other?.offer).toHaveLength(1)
  })

  it('zero tira a carta da oferta', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const tradeId = await tradeBetween(ana, bruno)
    const variant = await availableForTrade(ana, 3)

    await setOfferItem(testPrisma(), ana.user, tradeId, {
      cardVariantId: variant.id,
      quantity: 2,
    })
    await setOfferItem(testPrisma(), ana.user, tradeId, {
      cardVariantId: variant.id,
      quantity: 0,
    })

    expect((await getTrade(testPrisma(), ana.user, tradeId)).me.offer).toEqual([])
  })

  it('recusa quantidade negativa', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const tradeId = await tradeBetween(ana, bruno)
    const variant = await availableForTrade(ana, 3)

    await expect(
      setOfferItem(testPrisma(), ana.user, tradeId, {
        cardVariantId: variant.id,
        quantity: -1,
      }),
    ).rejects.toThrow(/zero ou mais/i)
  })
})

describe('confirmar e revogar', () => {
  it('valida quando os dois confirmam', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const tradeId = await tradeBetween(ana, bruno)

    const primeira = await confirmTrade(testPrisma(), ana.user, tradeId)
    const segunda = await confirmTrade(testPrisma(), bruno.user, tradeId)

    expect(primeira.validated).toBe(false)
    expect(segunda.validated).toBe(true)
    expect((await getTrade(testPrisma(), ana.user, tradeId)).status).toBe('CONFIRMED')
  })

  it('nao confirma troca sem a segunda pessoa', async () => {
    const ana = await person('Ana')
    const { tradeId } = await startTrade(testPrisma(), ana.user)

    await expect(confirmTrade(testPrisma(), ana.user, tradeId)).rejects.toThrow(
      /precisa das duas pessoas/i,
    )
  })

  /**
   * O caso que o dono do produto escreveu: um confirma, o outro altera, e a
   * confirmacao cai.
   */
  it('a alteracao de um derruba a confirmacao do outro', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const tradeId = await tradeBetween(ana, bruno)
    const variant = await availableForTrade(bruno, 3)

    await confirmTrade(testPrisma(), ana.user, tradeId)
    await setOfferItem(testPrisma(), bruno.user, tradeId, {
      cardVariantId: variant.id,
      quantity: 1,
    })

    const view = await getTrade(testPrisma(), ana.user, tradeId)
    expect(view.me.confirmed).toBe(false)
    // E pede revisao a ela, que e o aviso da regra 4.6.3.
    expect(view.me.reviewRequested).toBe(true)
  })

  /**
   * Quem alterou sabe o que fez. Mandar a pessoa revisar o proprio gesto seria
   * ruido, e ruido num aviso e o que faz o aviso deixar de ser lido.
   */
  it('nao pede revisao a quem alterou', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const tradeId = await tradeBetween(ana, bruno)
    const variant = await availableForTrade(bruno, 3)

    await confirmTrade(testPrisma(), ana.user, tradeId)
    await confirmTrade(testPrisma(), bruno.user, tradeId)
    await setOfferItem(testPrisma(), bruno.user, tradeId, {
      cardVariantId: variant.id,
      quantity: 1,
    })

    const paraBruno = await getTrade(testPrisma(), bruno.user, tradeId)
    expect(paraBruno.me.confirmed).toBe(false)
    expect(paraBruno.me.reviewRequested).toBe(false)
    expect(paraBruno.other?.reviewRequested).toBe(true)
  })

  it('confirmar de novo encerra o pedido de revisao', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const tradeId = await tradeBetween(ana, bruno)
    const variant = await availableForTrade(bruno, 3)

    await confirmTrade(testPrisma(), ana.user, tradeId)
    await setOfferItem(testPrisma(), bruno.user, tradeId, {
      cardVariantId: variant.id,
      quantity: 1,
    })
    await confirmTrade(testPrisma(), ana.user, tradeId)

    const view = await getTrade(testPrisma(), ana.user, tradeId)
    expect(view.me.confirmed).toBe(true)
    expect(view.me.reviewRequested).toBe(false)
  })

  /** Nao ha o que revisar quando ninguem tinha confirmado ainda. */
  it('nao pede revisao numa troca que ninguem confirmou', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const tradeId = await tradeBetween(ana, bruno)
    const variant = await availableForTrade(bruno, 3)

    await setOfferItem(testPrisma(), bruno.user, tradeId, {
      cardVariantId: variant.id,
      quantity: 1,
    })

    expect((await getTrade(testPrisma(), ana.user, tradeId)).me.reviewRequested).toBe(false)
  })

  /**
   * A leitura confirmada pelo dono do produto: quem confirmou e mudou a
   * propria oferta nao confirmou esta.
   */
  it('a alteracao derruba tambem a confirmacao de quem alterou', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const tradeId = await tradeBetween(ana, bruno)
    const variant = await availableForTrade(ana, 3)

    await confirmTrade(testPrisma(), ana.user, tradeId)
    await setOfferItem(testPrisma(), ana.user, tradeId, {
      cardVariantId: variant.id,
      quantity: 1,
    })

    expect((await getTrade(testPrisma(), ana.user, tradeId)).me.confirmed).toBe(false)
  })

  it('a troca confirmada volta a negociacao quando alguem altera', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const tradeId = await tradeBetween(ana, bruno)
    const variant = await availableForTrade(ana, 3)

    await confirmTrade(testPrisma(), ana.user, tradeId)
    await confirmTrade(testPrisma(), bruno.user, tradeId)
    await setOfferItem(testPrisma(), ana.user, tradeId, {
      cardVariantId: variant.id,
      quantity: 1,
    })

    const view = await getTrade(testPrisma(), ana.user, tradeId)
    expect(view.status).toBe('NEGOTIATING')
    expect(view.validated).toBe(false)
  })

  /** Mudar de ideia nao deveria exigir mexer nas cartas. */
  it('da para retirar a confirmacao sem alterar a oferta', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const tradeId = await tradeBetween(ana, bruno)

    await confirmTrade(testPrisma(), ana.user, tradeId)
    await withdrawConfirmation(testPrisma(), ana.user, tradeId)

    expect((await getTrade(testPrisma(), ana.user, tradeId)).me.confirmed).toBe(false)
  })
})

describe('cancelar', () => {
  it('encerra a troca e recusa alteracao depois', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const tradeId = await tradeBetween(ana, bruno)
    const variant = await availableForTrade(ana, 3)

    await cancelTrade(testPrisma(), bruno.user, tradeId)

    expect((await getTrade(testPrisma(), ana.user, tradeId)).status).toBe('CANCELLED')
    await expect(
      setOfferItem(testPrisma(), ana.user, tradeId, {
        cardVariantId: variant.id,
        quantity: 1,
      }),
    ).rejects.toThrow(/não aceita mais alterações/i)
  })

  it('libera a pessoa para comecar outra troca', async () => {
    const ana = await person('Ana')
    const bruno = await person('Bruno')
    const tradeId = await tradeBetween(ana, bruno)

    await cancelTrade(testPrisma(), ana.user, tradeId)

    await expect(startTrade(testPrisma(), ana.user)).resolves.toBeTruthy()
  })
})
