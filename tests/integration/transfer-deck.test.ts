import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { AuthenticatedUser } from '@/server/application/auth'
import { saveDeck } from '@/server/application/decks/saved-decks'
import { executeDeckTransfer, planDeckTransfer } from '@/server/application/decks/transfer-deck'
import { NotFoundError, ValidationError } from '@/server/domain/errors'
import { createUser, disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * Transferir a decklist para uma deckbox (decisão 109).
 *
 * O que se protege aqui são as regras que o dono do produto definiu em 22/09, e
 * que existem por causa da **regra 3.3** — "ninguém decide por quem tem a carta
 * de qual local as cópias saem":
 *
 * - uma única pilha fora de troca cobre tudo? o sistema resolve;
 * - mais de uma possibilidade? ele pergunta;
 * - local de troca não entra por padrão.
 */

async function pessoa(): Promise<AuthenticatedUser> {
  const criada = await createUser('Montadora')
  await testPrisma().user.update({
    where: { id: criada.id },
    data: { plan: 'PREMIUM', premiumUntil: new Date('2027-01-01T00:00:00Z') },
  })
  return {
    id: criada.id,
    email: criada.email,
    name: 'Montadora',
    plan: 'PREMIUM',
    premiumUntil: new Date('2027-01-01T00:00:00Z'),
  }
}

async function carta(code: string, type: string) {
  const db = testPrisma()
  const color = await db.color.upsert({ where: { name: 'Red' }, create: { name: 'Red' }, update: {} })
  const card = await db.card.create({
    data: { code, name: `Carta ${code}`, type, colors: { create: { colorId: color.id } } },
  })
  const variant = await db.cardVariant.create({
    data: { cardId: card.id, variantType: 'Normal', source: 'teste', sourceId: code },
  })
  return { cardId: card.id, id: String(variant.id), rawId: variant.id }
}

async function outraArte(cardId: bigint, sourceId: string) {
  const v = await testPrisma().cardVariant.create({
    data: { cardId, variantType: 'Parallel', source: 'teste', sourceId },
  })
  return { id: String(v.id), rawId: v.id }
}

async function local(user: AuthenticatedUser, name: string, type: string, purpose: string | null) {
  const l = await testPrisma().storageLocation.create({
    data: { userId: user.id, name, type, purpose },
  })
  return { id: String(l.id), rawId: l.id }
}

/** Põe cópias na coleção e as aloca num local. */
async function guardar(user: AuthenticatedUser, variantId: bigint, locationId: bigint, quantity: number) {
  const db = testPrisma()
  const colecao = await db.collection.findFirstOrThrow({ where: { userId: user.id } })
  const item = await db.collectionItem.upsert({
    where: { collectionId_cardVariantId: { collectionId: colecao.id, cardVariantId: variantId } },
    create: { collectionId: colecao.id, cardVariantId: variantId, quantity },
    update: { quantity: { increment: quantity } },
  })
  await db.collectionItemLocation.upsert({
    where: { collectionItemId_storageLocationId: { collectionItemId: item.id, storageLocationId: locationId } },
    create: { collectionItemId: item.id, storageLocationId: locationId, quantity },
    update: { quantity: { increment: quantity } },
  })
}

/** Um deck de um líder e uma carta, que é o bastante para as regras. */
async function deckDe(user: AuthenticatedUser, lider: string, linha: { id: string; copies: number }) {
  const { id } = await saveDeck(testPrisma(), user, {
    name: 'Para transferir',
    leaderVariantId: lider,
    lines: [{ variantId: linha.id, copies: linha.copies }],
    autoComplete: true,
  })
  return id
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('planDeckTransfer', () => {
  it('resolve sozinho quando uma única pilha fora de troca cobre tudo', async () => {
    const ana = await pessoa()
    const binder = await local(ana, 'Binder', 'BINDER', 'COLLECTION')
    const box = await local(ana, 'Deck Luffy', 'DECK', null)
    const lider = await carta('OP01-001', 'Leader')
    const zoro = await carta('OP01-025', 'Character')

    await guardar(ana, lider.rawId, binder.rawId, 1)
    await guardar(ana, zoro.rawId, binder.rawId, 4)
    const deck = await deckDe(ana, lider.id, { id: zoro.id, copies: 4 })

    const plano = await planDeckTransfer(testPrisma(), ana, deck, box.id)

    expect(plano.lines.every((l) => l.status === 'auto')).toBe(true)
    expect(plano.lines.find((l) => l.cardCode === 'OP01-025')?.take).toEqual([
      { variantId: zoro.id, locationId: binder.id, copies: 4 },
    ])
  })

  /*
   * O coração da regra 3.3: duas pilhas que **juntas** cobrem não resolvem
   * sozinhas. Escolher uma seria presumir a ordem que a regra protege.
   */
  it('pergunta quando há mais de uma pilha possível', async () => {
    const ana = await pessoa()
    const binder = await local(ana, 'Binder', 'BINDER', 'COLLECTION')
    const caixa = await local(ana, 'Caixa', 'BOX', 'COLLECTION')
    const box = await local(ana, 'Deck Luffy', 'DECK', null)
    const lider = await carta('OP01-001', 'Leader')
    const zoro = await carta('OP01-025', 'Character')

    await guardar(ana, lider.rawId, binder.rawId, 1)
    await guardar(ana, zoro.rawId, binder.rawId, 2)
    await guardar(ana, zoro.rawId, caixa.rawId, 2)
    const deck = await deckDe(ana, lider.id, { id: zoro.id, copies: 4 })

    const plano = await planDeckTransfer(testPrisma(), ana, deck, box.id)

    const linha = plano.lines.find((l) => l.cardCode === 'OP01-025')!
    expect(linha.status).toBe('ambiguous')
    expect(linha.options.map((o) => o.locationName).sort()).toEqual(['Binder', 'Caixa'])
  })

  /* Local de troca não entra por padrão: o sistema tenta completar sem ele. */
  it('prefere a pilha fora de troca, e nem oferece a de troca', async () => {
    const ana = await pessoa()
    const binder = await local(ana, 'Binder', 'BINDER', 'COLLECTION')
    const troca = await local(ana, 'Troca', 'BINDER', 'TRADE')
    const box = await local(ana, 'Deck Luffy', 'DECK', null)
    const lider = await carta('OP01-001', 'Leader')
    const zoro = await carta('OP01-025', 'Character')

    await guardar(ana, lider.rawId, binder.rawId, 1)
    await guardar(ana, zoro.rawId, binder.rawId, 4)
    await guardar(ana, zoro.rawId, troca.rawId, 4)
    const deck = await deckDe(ana, lider.id, { id: zoro.id, copies: 4 })

    const plano = await planDeckTransfer(testPrisma(), ana, deck, box.id)

    const linha = plano.lines.find((l) => l.cardCode === 'OP01-025')!
    expect(linha.status).toBe('auto')
    expect(linha.take[0].locationId).toBe(binder.id)
    expect(plano.fromTradeCopies).toBe(0)
  })

  /* Só dá para completar com o que está em troca: aí a pessoa decide. */
  it('marca a linha quando só o local de troca tem as cópias', async () => {
    const ana = await pessoa()
    const binder = await local(ana, 'Binder', 'BINDER', 'COLLECTION')
    const troca = await local(ana, 'Troca', 'BINDER', 'TRADE')
    const box = await local(ana, 'Deck Luffy', 'DECK', null)
    const lider = await carta('OP01-001', 'Leader')
    const zoro = await carta('OP01-025', 'Character')

    await guardar(ana, lider.rawId, binder.rawId, 1)
    await guardar(ana, zoro.rawId, troca.rawId, 4)
    const deck = await deckDe(ana, lider.id, { id: zoro.id, copies: 4 })

    const plano = await planDeckTransfer(testPrisma(), ana, deck, box.id)

    const linha = plano.lines.find((l) => l.cardCode === 'OP01-025')!
    expect(linha.status).toBe('trade-needed')
    expect(plano.fromTradeCopies).toBe(4)
  })

  /*
   * O aviso que o dono do produto lembrou: a arte que vai para a caixa não é a
   * que ele escolheu na lista (decisão 095, o mesmo `otherArt` da conferência).
   */
  it('avisa quando as cópias são de outra arte', async () => {
    const ana = await pessoa()
    const binder = await local(ana, 'Binder', 'BINDER', 'COLLECTION')
    const box = await local(ana, 'Deck Luffy', 'DECK', null)
    const lider = await carta('OP01-001', 'Leader')
    const zoro = await carta('OP01-025', 'Character')
    const paralela = await outraArte(zoro.cardId, 'OP01-025_p1')

    await guardar(ana, lider.rawId, binder.rawId, 1)
    await guardar(ana, paralela.rawId, binder.rawId, 4)
    // A lista pede a Normal; a coleção só tem a Parallel.
    const deck = await deckDe(ana, lider.id, { id: zoro.id, copies: 4 })

    const plano = await planDeckTransfer(testPrisma(), ana, deck, box.id)

    const linha = plano.lines.find((l) => l.cardCode === 'OP01-025')!
    expect(linha.status).toBe('auto')
    expect(linha.takeOtherArt).toBe(true)
  })

  it('não repete o que já está na deckbox', async () => {
    const ana = await pessoa()
    const binder = await local(ana, 'Binder', 'BINDER', 'COLLECTION')
    const box = await local(ana, 'Deck Luffy', 'DECK', null)
    const lider = await carta('OP01-001', 'Leader')
    const zoro = await carta('OP01-025', 'Character')

    await guardar(ana, lider.rawId, box.rawId, 1)
    await guardar(ana, zoro.rawId, binder.rawId, 4)
    const deck = await deckDe(ana, lider.id, { id: zoro.id, copies: 4 })

    const plano = await planDeckTransfer(testPrisma(), ana, deck, box.id)

    expect(plano.lines.find((l) => l.cardCode === 'OP01-001')?.status).toBe('done')
  })

  it('marca o que a pessoa não tem', async () => {
    const ana = await pessoa()
    const binder = await local(ana, 'Binder', 'BINDER', 'COLLECTION')
    const box = await local(ana, 'Deck Luffy', 'DECK', null)
    const lider = await carta('OP01-001', 'Leader')
    const zoro = await carta('OP01-025', 'Character')

    await guardar(ana, lider.rawId, binder.rawId, 1)
    const deck = await deckDe(ana, lider.id, { id: zoro.id, copies: 4 })

    const plano = await planDeckTransfer(testPrisma(), ana, deck, box.id)

    expect(plano.lines.find((l) => l.cardCode === 'OP01-025')?.status).toBe('missing')
  })

  /* "Deckbox escolhida": o destino é do tipo Deck, e só ele. */
  it('recusa destino que não é deck', async () => {
    const ana = await pessoa()
    const binder = await local(ana, 'Binder', 'BINDER', 'COLLECTION')
    const lider = await carta('OP01-001', 'Leader')
    const zoro = await carta('OP01-025', 'Character')
    await guardar(ana, lider.rawId, binder.rawId, 1)
    const deck = await deckDe(ana, lider.id, { id: zoro.id, copies: 1 })

    await expect(planDeckTransfer(testPrisma(), ana, deck, binder.id)).rejects.toThrow(/deck/i)
  })
})

describe('executeDeckTransfer', () => {
  it('move as cópias e esvazia a origem', async () => {
    const ana = await pessoa()
    const binder = await local(ana, 'Binder', 'BINDER', 'COLLECTION')
    const box = await local(ana, 'Deck Luffy', 'DECK', null)
    const lider = await carta('OP01-001', 'Leader')
    const zoro = await carta('OP01-025', 'Character')

    await guardar(ana, lider.rawId, binder.rawId, 1)
    await guardar(ana, zoro.rawId, binder.rawId, 4)
    const deck = await deckDe(ana, lider.id, { id: zoro.id, copies: 4 })
    const plano = await planDeckTransfer(testPrisma(), ana, deck, box.id)

    const resultado = await executeDeckTransfer(
      testPrisma(),
      ana,
      deck,
      box.id,
      plano.lines.flatMap((l) => l.take),
    )

    expect(resultado.moved).toBe(5)
    const naCaixa = await testPrisma().collectionItemLocation.findMany({
      where: { storageLocationId: box.rawId },
      select: { quantity: true },
    })
    expect(naCaixa.reduce((s, l) => s + l.quantity, 0)).toBe(5)
    // A origem ficou sem nada desta carta: a linha some, não fica em zero.
    expect(
      await testPrisma().collectionItemLocation.count({ where: { storageLocationId: binder.rawId } }),
    ).toBe(0)
  })

  /* A tela é conveniência: um envio à mão não pode mover carta fora da lista. */
  it('recusa carta que não está na decklist', async () => {
    const ana = await pessoa()
    const binder = await local(ana, 'Binder', 'BINDER', 'COLLECTION')
    const box = await local(ana, 'Deck Luffy', 'DECK', null)
    const lider = await carta('OP01-001', 'Leader')
    const zoro = await carta('OP01-025', 'Character')
    const forasteira = await carta('OP01-099', 'Character')

    await guardar(ana, lider.rawId, binder.rawId, 1)
    await guardar(ana, zoro.rawId, binder.rawId, 1)
    await guardar(ana, forasteira.rawId, binder.rawId, 1)
    const deck = await deckDe(ana, lider.id, { id: zoro.id, copies: 1 })

    await expect(
      executeDeckTransfer(testPrisma(), ana, deck, box.id, [
        { variantId: forasteira.id, locationId: binder.id, copies: 1 },
      ]),
    ).rejects.toThrow(/não está na decklist/i)
  })

  it('recusa mais cópias do que existem no local', async () => {
    const ana = await pessoa()
    const binder = await local(ana, 'Binder', 'BINDER', 'COLLECTION')
    const box = await local(ana, 'Deck Luffy', 'DECK', null)
    const lider = await carta('OP01-001', 'Leader')
    const zoro = await carta('OP01-025', 'Character')

    await guardar(ana, lider.rawId, binder.rawId, 1)
    await guardar(ana, zoro.rawId, binder.rawId, 2)
    const deck = await deckDe(ana, lider.id, { id: zoro.id, copies: 4 })

    await expect(
      executeDeckTransfer(testPrisma(), ana, deck, box.id, [
        { variantId: zoro.id, locationId: binder.id, copies: 4 },
      ]),
    ).rejects.toThrow(/Só há 2/)
  })

  it('não mexe na lista de outra pessoa', async () => {
    const ana = await pessoa()
    const bia = await pessoa()
    const binder = await local(ana, 'Binder', 'BINDER', 'COLLECTION')
    const box = await local(bia, 'Deck da Bia', 'DECK', null)
    const lider = await carta('OP01-001', 'Leader')
    const zoro = await carta('OP01-025', 'Character')
    await guardar(ana, lider.rawId, binder.rawId, 1)
    const deck = await deckDe(ana, lider.id, { id: zoro.id, copies: 1 })

    await expect(planDeckTransfer(testPrisma(), bia, deck, box.id)).rejects.toThrow(NotFoundError)
  })

  it('recusa transferência vazia', async () => {
    const ana = await pessoa()
    const binder = await local(ana, 'Binder', 'BINDER', 'COLLECTION')
    const box = await local(ana, 'Deck Luffy', 'DECK', null)
    const lider = await carta('OP01-001', 'Leader')
    const zoro = await carta('OP01-025', 'Character')
    await guardar(ana, lider.rawId, binder.rawId, 1)
    const deck = await deckDe(ana, lider.id, { id: zoro.id, copies: 1 })

    await expect(executeDeckTransfer(testPrisma(), ana, deck, box.id, [])).rejects.toThrow(
      ValidationError,
    )
  })
})
