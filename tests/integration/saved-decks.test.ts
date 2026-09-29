import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { AuthenticatedUser } from '@/server/application/auth'
import { deleteDeck, listDecks, readDeck, saveDeck } from '@/server/application/decks/saved-decks'
import { NotFoundError, ValidationError } from '@/server/domain/errors'
import { createUser, disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * As decklists salvas (decisão 108, que muda a 095).
 *
 * O que se protege aqui: salvar não aceita o que a conferência recusa, a lista é
 * só de quem a criou, e o progresso conta **qualquer arte da mesma carta** —
 * escolha do dono do produto, porque a pergunta é "consigo jogar isto?".
 */

async function pessoa(premium = true): Promise<AuthenticatedUser> {
  const criada = await createUser('Montadora')
  if (premium) {
    await testPrisma().user.update({
      where: { id: criada.id },
      data: { plan: 'PREMIUM', premiumUntil: new Date('2027-01-01T00:00:00Z') },
    })
  }
  return {
    id: criada.id,
    email: criada.email,
    name: 'Montadora',
    plan: premium ? 'PREMIUM' : 'FREE',
    premiumUntil: premium ? new Date('2027-01-01T00:00:00Z') : null,
  }
}

/** Uma carta do catálogo, com cor, para o deck aceitar. */
async function carta(code: string, type: string, cor: string) {
  const db = testPrisma()
  const color = await db.color.upsert({ where: { name: cor }, create: { name: cor }, update: {} })
  const card = await db.card.create({
    data: { code, name: `Carta ${code}`, type, colors: { create: { colorId: color.id } } },
  })
  const variant = await db.cardVariant.create({
    data: { cardId: card.id, variantType: 'Normal', source: 'teste', sourceId: code },
  })
  return { cardId: card.id, id: String(variant.id), rawId: variant.id }
}

/** Uma segunda arte da mesma carta: é ela que prova o "qualquer arte". */
async function outraArte(cardId: bigint, sourceId: string) {
  const variant = await testPrisma().cardVariant.create({
    data: { cardId, variantType: 'Parallel', source: 'teste', sourceId },
  })
  return { id: String(variant.id), rawId: variant.id }
}

async function possuir(user: AuthenticatedUser, variantId: bigint, quantity: number) {
  const db = testPrisma()
  const colecao = await db.collection.findFirstOrThrow({ where: { userId: user.id } })
  await db.collectionItem.create({
    data: { collectionId: colecao.id, cardVariantId: variantId, quantity },
  })
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('saveDeck', () => {
  it('guarda a lista com o nome e o líder', async () => {
    const ana = await pessoa()
    const lider = await carta('OP01-001', 'Leader', 'Red')
    const zoro = await carta('OP01-025', 'Character', 'Red')

    const { id } = await saveDeck(testPrisma(), ana, {
      name: '  Luffy agressivo  ',
      leaderVariantId: lider.id,
      lines: [{ variantId: zoro.id, copies: 4 }],
      autoComplete: true,
    })

    const salvo = await readDeck(testPrisma(), ana, id)
    expect(salvo.name).toBe('Luffy agressivo')
    expect(salvo.leader.variantId).toBe(lider.id)
    expect(salvo.lines).toEqual([expect.objectContaining({ variantId: zoro.id, copies: 4 })])
  })

  /* Salvar incompleta é o caso normal de quem monta aos poucos. */
  it('aceita lista incompleta, e ela fica marcada', async () => {
    const ana = await pessoa()
    const lider = await carta('OP01-001', 'Leader', 'Red')
    const zoro = await carta('OP01-025', 'Character', 'Red')

    await saveDeck(testPrisma(), ana, {
      name: 'Começando',
      leaderVariantId: lider.id,
      lines: [{ variantId: zoro.id, copies: 2 }],
      autoComplete: true,
    })

    const [lista] = await listDecks(testPrisma(), ana)
    expect(lista).toMatchObject({ cards: 2, incomplete: true })
  })

  /*
   * Salvar e conferir usam o **mesmo** código de regras. Se divergissem, a lista
   * salva aceitaria o que a tela recusa — e o erro só apareceria ao reabrir.
   */
  it('recusa o que a conferência recusaria', async () => {
    const ana = await pessoa()
    const lider = await carta('OP01-001', 'Leader', 'Red')
    const azul = await carta('OP01-060', 'Character', 'Blue')
    const zoro = await carta('OP01-025', 'Character', 'Red')

    await expect(
      saveDeck(testPrisma(), ana, {
        name: 'Fora da cor',
        leaderVariantId: lider.id,
        lines: [{ variantId: azul.id, copies: 1 }],
        autoComplete: true,
      }),
    ).rejects.toThrow(/cor do líder/i)

    await expect(
      saveDeck(testPrisma(), ana, {
        name: 'Cinco cópias',
        leaderVariantId: lider.id,
        lines: [{ variantId: zoro.id, copies: 5 }],
        autoComplete: true,
      }),
    ).rejects.toThrow(ValidationError)
  })

  it('exige um nome', async () => {
    const ana = await pessoa()
    const lider = await carta('OP01-001', 'Leader', 'Red')
    const zoro = await carta('OP01-025', 'Character', 'Red')

    await expect(
      saveDeck(testPrisma(), ana, {
        name: '   ',
        leaderVariantId: lider.id,
        lines: [{ variantId: zoro.id, copies: 1 }],
        autoComplete: true,
      }),
    ).rejects.toThrow(/nome/i)
  })

  /* Quem abriu uma lista para corrigir não espera terminar com duas. */
  it('regrava a mesma lista em vez de criar outra', async () => {
    const ana = await pessoa()
    const lider = await carta('OP01-001', 'Leader', 'Red')
    const zoro = await carta('OP01-025', 'Character', 'Red')
    const nami = await carta('OP01-016', 'Character', 'Red')

    const { id } = await saveDeck(testPrisma(), ana, {
      name: 'Primeira',
      leaderVariantId: lider.id,
      lines: [{ variantId: zoro.id, copies: 4 }],
      autoComplete: true,
    })
    await saveDeck(testPrisma(), ana, {
      id,
      name: 'Corrigida',
      leaderVariantId: lider.id,
      lines: [{ variantId: nami.id, copies: 2 }],
      autoComplete: true,
    })

    const listas = await listDecks(testPrisma(), ana)
    expect(listas).toHaveLength(1)
    expect(listas[0].name).toBe('Corrigida')
    const salvo = await readDeck(testPrisma(), ana, id)
    expect(salvo.lines).toEqual([expect.objectContaining({ variantId: nami.id, copies: 2 })])
  })

  it('não deixa regravar a lista de outra pessoa', async () => {
    const ana = await pessoa()
    const bia = await pessoa()
    const lider = await carta('OP01-001', 'Leader', 'Red')
    const zoro = await carta('OP01-025', 'Character', 'Red')

    const { id } = await saveDeck(testPrisma(), ana, {
      name: 'Da Ana',
      leaderVariantId: lider.id,
      lines: [{ variantId: zoro.id, copies: 1 }],
      autoComplete: true,
    })

    await expect(
      saveDeck(testPrisma(), bia, {
        id,
        name: 'Roubada',
        leaderVariantId: lider.id,
        lines: [{ variantId: zoro.id, copies: 1 }],
        autoComplete: true,
      }),
    ).rejects.toThrow(NotFoundError)
  })

  it('recusa quem não é Premium', async () => {
    const free = await pessoa(false)
    const lider = await carta('OP01-001', 'Leader', 'Red')
    const zoro = await carta('OP01-025', 'Character', 'Red')

    await expect(
      saveDeck(testPrisma(), free, {
        name: 'Sem Premium',
        leaderVariantId: lider.id,
        lines: [{ variantId: zoro.id, copies: 1 }],
        autoComplete: true,
      }),
    ).rejects.toThrow(/Premium/i)
  })
})

describe('listDecks', () => {
  /*
   * O progresso conta **qualquer arte** da mesma carta: a pergunta é "consigo
   * jogar este deck?", e para jogar a arte não importa.
   */
  it('conta qualquer arte da mesma carta, e o líder junto', async () => {
    const ana = await pessoa()
    const lider = await carta('OP01-001', 'Leader', 'Red')
    const zoro = await carta('OP01-025', 'Character', 'Red')
    const zoroParalela = await outraArte(zoro.cardId, 'OP01-025_p1')

    await possuir(ana, lider.rawId, 1)
    await possuir(ana, zoroParalela.rawId, 3)

    await saveDeck(testPrisma(), ana, {
      name: 'Contagem',
      leaderVariantId: lider.id,
      lines: [{ variantId: zoro.id, copies: 4 }],
      autoComplete: true,
    })

    // 1 do líder + 3 da paralela, embora a lista peça a Normal.
    expect((await listDecks(testPrisma(), ana))[0].owned).toBe(4)
  })

  /* Ter oito não adianta para um deck que pede quatro. */
  it('não conta mais do que a lista pede', async () => {
    const ana = await pessoa()
    const lider = await carta('OP01-001', 'Leader', 'Red')
    const zoro = await carta('OP01-025', 'Character', 'Red')

    await possuir(ana, zoro.rawId, 8)
    await saveDeck(testPrisma(), ana, {
      name: 'Teto',
      leaderVariantId: lider.id,
      lines: [{ variantId: zoro.id, copies: 4 }],
      autoComplete: true,
    })

    expect((await listDecks(testPrisma(), ana))[0].owned).toBe(4)
  })

  /*
   * Quem perde o Premium **não perde as listas**: elas continuam guardadas e
   * param de abrir. Por isso listar não exige Premium, e ler exige.
   */
  it('lista sem Premium, mas não abre', async () => {
    const ana = await pessoa()
    const lider = await carta('OP01-001', 'Leader', 'Red')
    const zoro = await carta('OP01-025', 'Character', 'Red')
    const { id } = await saveDeck(testPrisma(), ana, {
      name: 'Guardada',
      leaderVariantId: lider.id,
      lines: [{ variantId: zoro.id, copies: 1 }],
      autoComplete: true,
    })

    const venceu: AuthenticatedUser = { ...ana, plan: 'FREE', premiumUntil: null }
    expect(await listDecks(testPrisma(), venceu)).toHaveLength(1)
    await expect(readDeck(testPrisma(), venceu, id)).rejects.toThrow(/Premium/i)
  })

  it('só mostra as listas da própria pessoa', async () => {
    const ana = await pessoa()
    const bia = await pessoa()
    const lider = await carta('OP01-001', 'Leader', 'Red')
    const zoro = await carta('OP01-025', 'Character', 'Red')

    await saveDeck(testPrisma(), ana, {
      name: 'Da Ana',
      leaderVariantId: lider.id,
      lines: [{ variantId: zoro.id, copies: 1 }],
      autoComplete: true,
    })

    expect(await listDecks(testPrisma(), bia)).toHaveLength(0)
  })
})

describe('deleteDeck', () => {
  it('apaga a lista e os itens dela', async () => {
    const ana = await pessoa()
    const lider = await carta('OP01-001', 'Leader', 'Red')
    const zoro = await carta('OP01-025', 'Character', 'Red')
    const { id } = await saveDeck(testPrisma(), ana, {
      name: 'Para apagar',
      leaderVariantId: lider.id,
      lines: [{ variantId: zoro.id, copies: 1 }],
      autoComplete: true,
    })

    await deleteDeck(testPrisma(), ana, id)

    expect(await listDecks(testPrisma(), ana)).toHaveLength(0)
    expect(await testPrisma().deckItem.count()).toBe(0)
  })

  /* Quem deixou de assinar continua dono do que criou. */
  it('apaga mesmo sem Premium', async () => {
    const ana = await pessoa()
    const lider = await carta('OP01-001', 'Leader', 'Red')
    const zoro = await carta('OP01-025', 'Character', 'Red')
    const { id } = await saveDeck(testPrisma(), ana, {
      name: 'Faxina',
      leaderVariantId: lider.id,
      lines: [{ variantId: zoro.id, copies: 1 }],
      autoComplete: true,
    })

    await deleteDeck(testPrisma(), { ...ana, plan: 'FREE', premiumUntil: null }, id)
    expect(await listDecks(testPrisma(), ana)).toHaveLength(0)
  })

  it('não apaga a lista de outra pessoa', async () => {
    const ana = await pessoa()
    const bia = await pessoa()
    const lider = await carta('OP01-001', 'Leader', 'Red')
    const zoro = await carta('OP01-025', 'Character', 'Red')
    const { id } = await saveDeck(testPrisma(), ana, {
      name: 'Da Ana',
      leaderVariantId: lider.id,
      lines: [{ variantId: zoro.id, copies: 1 }],
      autoComplete: true,
    })

    await expect(deleteDeck(testPrisma(), bia, id)).rejects.toThrow(NotFoundError)
    expect(await listDecks(testPrisma(), ana)).toHaveLength(1)
  })
})
