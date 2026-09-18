import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { AuthenticatedUser } from '@/server/application/auth'
import { PREMIUM_REQUIRED } from '@/server/application/authorization'
import { analyzeDeck } from '@/server/application/decks/analyze-deck'
import { ValidationError } from '@/server/domain/errors'
import { allocate, createStorage, createUser, disconnect, own, resetDatabase, testPrisma } from '../helpers'

/**
 * A conferência de deck (decisão 095).
 *
 * Regras do dono do produto: recurso Premium, nada é guardado, o inválido é
 * recusado, o preço é o da arte escolhida, e as cópias em local de troca e sem
 * local **contam** — a tela é que avisa onde estão.
 */

const AMANHA = new Date(Date.now() + 24 * 60 * 60 * 1000)

async function pessoa(premium = true): Promise<AuthenticatedUser & { collectionId: bigint }> {
  const criada = await createUser('Dona do deck')
  if (premium) {
    await testPrisma().user.update({
      where: { id: criada.id },
      data: { plan: 'PREMIUM', premiumUntil: AMANHA },
    })
  }
  return {
    id: criada.id,
    email: criada.email,
    name: 'Dona do deck',
    plan: premium ? 'PREMIUM' : 'FREE',
    premiumUntil: premium ? AMANHA : null,
    collectionId: criada.collection!.id,
  }
}

/** Uma carta com as cores pedidas, e quantas artes se quiser. */
async function carta(
  code: string,
  type: 'Leader' | 'Character' | 'Event' | 'Stage',
  cores: string[],
  artes: string[] = ['Normal'],
) {
  const card = await testPrisma().card.create({
    data: {
      code,
      name: `Carta ${code}`,
      type,
      colors: {
        create: cores.map((nome) => ({
          color: { connectOrCreate: { where: { name: nome }, create: { name: nome } } },
        })),
      },
      variants: { create: artes.map((variantType) => ({ variantType })) },
    },
    include: { variants: true },
  })
  return { card, variants: card.variants }
}

const preco = (cardVariantId: bigint, value: number) =>
  testPrisma().cardPrice.create({ data: { cardVariantId, value, capturedAt: new Date() } })

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('quem pode conferir', () => {
  it('é Premium; o Free recebe o aviso', async () => {
    const free = await pessoa(false)
    const { variants: lider } = await carta('OP01-001', 'Leader', ['Red'])
    const { variants: personagem } = await carta('OP01-016', 'Character', ['Red'])

    await expect(
      analyzeDeck(testPrisma(), free, {
        leaderVariantId: String(lider[0].id),
        lines: [{ variantId: String(personagem[0].id), copies: 1 }],
        autoComplete: true,
      }),
    ).rejects.toMatchObject({ code: PREMIUM_REQUIRED })
  })
})

describe('as regras do deck', () => {
  it('recusa carta fora da cor do líder, dizendo qual é', async () => {
    const dona = await pessoa()
    const { variants: lider } = await carta('OP01-001', 'Leader', ['Red'])
    const { variants: azul } = await carta('OP02-020', 'Character', ['Blue'])

    const erro = await analyzeDeck(testPrisma(), dona, {
      leaderVariantId: String(lider[0].id),
      lines: [{ variantId: String(azul[0].id), copies: 1 }],
      autoComplete: true,
    }).catch((e) => e)

    expect(erro).toBeInstanceOf(ValidationError)
    expect(erro.message).toMatch(/OP02-020/)
    expect(erro.message).toMatch(/Red/)
  })

  it('líder de duas cores aceita as duas', async () => {
    const dona = await pessoa()
    const { variants: lider } = await carta('OP01-002', 'Leader', ['Red', 'Green'])
    const { variants: verde } = await carta('OP03-030', 'Character', ['Green'])

    const analise = await analyzeDeck(testPrisma(), dona, {
      leaderVariantId: String(lider[0].id),
      lines: [{ variantId: String(verde[0].id), copies: 2 }],
      autoComplete: true,
    })
    expect(analise.leader.colors).toEqual(expect.arrayContaining(['Red', 'Green']))
    // Desde que o lider entrou na conferencia (pedido do dono do produto: 51
    // cartas), o total conta ele; o que falta para as 50 continua sem ele.
    expect(analise.total).toBe(3)
    expect(analise.remaining).toBe(48)
  })

  it('recusa mais de quatro cópias da mesma carta, somando as artes', async () => {
    const dona = await pessoa()
    const { variants: lider } = await carta('OP01-001', 'Leader', ['Red'])
    const { variants } = await carta('OP01-016', 'Character', ['Red'], ['Normal', 'Parallel'])

    await expect(
      analyzeDeck(testPrisma(), dona, {
        leaderVariantId: String(lider[0].id),
        lines: [
          { variantId: String(variants[0].id), copies: 3 },
          { variantId: String(variants[1].id), copies: 2 },
        ],
        autoComplete: true,
      }),
    ).rejects.toThrow(/OP01-016/)
  })

  it('recusa um Leader no meio do deck', async () => {
    const dona = await pessoa()
    const { variants: lider } = await carta('OP01-001', 'Leader', ['Red'])
    const { variants: outroLider } = await carta('OP01-003', 'Leader', ['Red'])

    await expect(
      analyzeDeck(testPrisma(), dona, {
        leaderVariantId: String(lider[0].id),
        lines: [{ variantId: String(outroLider[0].id), copies: 1 }],
        autoComplete: true,
      }),
    ).rejects.toThrow(/Leader/)
  })
})

describe('o que eu tenho, e onde está', () => {
  it('conta as cópias e diz o binder, o local de troca e o que está sem local', async () => {
    const dona = await pessoa()
    const { variants: lider } = await carta('OP01-001', 'Leader', ['Red'])
    const { variants } = await carta('OP01-016', 'Character', ['Red'])

    const item = await own(dona.collectionId, variants[0].id, 3)
    const binder = await createStorage(dona.id, 'BINDER', 'COLLECTION', 'Binder vermelho')
    const troca = await createStorage(dona.id, 'BOX', 'TRADE', 'Caixa de troca')
    await allocate(item.id, binder.id, 1)
    await allocate(item.id, troca.id, 1)
    // A terceira copia fica sem local: conta, e a tela avisa.

    const analise = await analyzeDeck(testPrisma(), dona, {
      leaderVariantId: String(lider[0].id),
      lines: [{ variantId: String(variants[0].id), copies: 4 }],
      autoComplete: true,
    })

    const linha = analise.lines[0]
    expect(linha).toMatchObject({ owned: 3, missing: 1 })
    expect(linha.places).toEqual(
      expect.arrayContaining([
        { location: 'Binder vermelho', forTrade: false, quantity: 1 },
        { location: 'Caixa de troca', forTrade: true, quantity: 1 },
        { location: null, forTrade: false, quantity: 1 },
      ]),
    )
  })

  it('auto completar ligado conta as outras artes; desligado, só a escolhida', async () => {
    const dona = await pessoa()
    const { variants: lider } = await carta('OP01-001', 'Leader', ['Red'])
    const { variants } = await carta('OP01-016', 'Character', ['Red'], ['Normal', 'Parallel'])
    await own(dona.collectionId, variants[1].id, 2) // só tem a paralela

    const pedido = {
      leaderVariantId: String(lider[0].id),
      lines: [{ variantId: String(variants[0].id), copies: 2 }],
    }

    const ligado = await analyzeDeck(testPrisma(), dona, { ...pedido, autoComplete: true })
    expect(ligado.lines[0]).toMatchObject({ owned: 2, missing: 0 })

    const desligado = await analyzeDeck(testPrisma(), dona, { ...pedido, autoComplete: false })
    expect(desligado.lines[0]).toMatchObject({ owned: 0, missing: 2 })
  })

  it('não conta a mesma cópia em duas linhas da mesma carta', async () => {
    const dona = await pessoa()
    const { variants: lider } = await carta('OP01-001', 'Leader', ['Red'])
    const { variants } = await carta('OP01-016', 'Character', ['Red'], ['Normal', 'Parallel'])
    await own(dona.collectionId, variants[0].id, 1)

    const analise = await analyzeDeck(testPrisma(), dona, {
      leaderVariantId: String(lider[0].id),
      lines: [
        { variantId: String(variants[0].id), copies: 2 },
        { variantId: String(variants[1].id), copies: 2 },
      ],
      autoComplete: true,
    })

    expect(analise.ownedTotal).toBe(1)
    // Tres da carta, mais o lider, que ninguem nesta conta possui.
    expect(analise.missingTotal).toBe(4)
  })
})

describe('o custo do que falta', () => {
  it('usa o preço da arte escolhida, e soma só o que falta', async () => {
    const dona = await pessoa()
    const { variants: lider } = await carta('OP01-001', 'Leader', ['Red'])
    const { variants } = await carta('OP01-016', 'Character', ['Red'], ['Normal', 'Parallel'])
    await preco(variants[0].id, 1.5)
    await preco(variants[1].id, 30)
    await own(dona.collectionId, variants[1].id, 1)

    const analise = await analyzeDeck(testPrisma(), dona, {
      leaderVariantId: String(lider[0].id),
      lines: [
        { variantId: String(variants[0].id), copies: 2 },
        { variantId: String(variants[1].id), copies: 2 },
      ],
      autoComplete: false,
    })

    // Faltam as duas normais (US$ 1,50) e uma paralela (US$ 30).
    expect(analise.lines[0]).toMatchObject({ missing: 2, unitUsd: 1.5, missingUsd: 3 })
    expect(analise.lines[1]).toMatchObject({ missing: 1, unitUsd: 30, missingUsd: 30 })
    expect(analise.cost.usd).toBe(33)
    // O lider falta e nao tem preco neste teste: fica fora da soma, e a tela sabe.
    expect(analise.cost.withoutPrice).toBe(1)
  })

  it('carta sem preço fica fora da conta, e a tela sabe quantas', async () => {
    const dona = await pessoa()
    const { variants: lider } = await carta('OP01-001', 'Leader', ['Red'])
    const { variants: comPreco } = await carta('OP01-016', 'Character', ['Red'])
    const { variants: semPreco } = await carta('OP01-017', 'Character', ['Red'])
    await preco(comPreco[0].id, 2)

    const analise = await analyzeDeck(testPrisma(), dona, {
      leaderVariantId: String(lider[0].id),
      lines: [
        { variantId: String(comPreco[0].id), copies: 1 },
        { variantId: String(semPreco[0].id), copies: 3 },
      ],
      autoComplete: true,
    })

    expect(analise.cost.usd).toBe(2)
    // As tres sem preco, mais o lider sem preco.
    expect(analise.cost.withoutPrice).toBe(4)
    expect(analise.lines[1].missingUsd).toBeNull()
  })

  it('converte para real quando há cotação utilizável', async () => {
    const dona = await pessoa()
    const { variants: lider } = await carta('OP01-001', 'Leader', ['Red'])
    const { variants } = await carta('OP01-016', 'Character', ['Red'])
    await preco(variants[0].id, 10)
    await testPrisma().exchangeRate.create({
      data: { baseCurrency: 'USD', quoteCurrency: 'BRL', rate: 5, quoteDate: new Date(), source: 'teste' },
    })

    const analise = await analyzeDeck(testPrisma(), dona, {
      leaderVariantId: String(lider[0].id),
      lines: [{ variantId: String(variants[0].id), copies: 1 }],
      autoComplete: true,
    })

    expect(analise.cost.brl).toEqual({ value: 50, rate: 5 })
  })
})

describe('o líder também é conferido (51 cartas)', () => {
  /*
   * Pedido do dono do produto: "conferir o que tenho" olha as 51 cartas. O
   * lider tem posse, lugar e preco como qualquer outra, e fica fora das regras
   * das 50 — cor, quatro copias e total.
   */
  it('diz se tem o líder, onde está, e soma o preço dele se faltar', async () => {
    const dona = await pessoa()
    const { variants: lider } = await carta('OP01-001', 'Leader', ['Red'])
    const { variants: personagem } = await carta('OP01-016', 'Character', ['Red'])
    await preco(lider[0].id, 12)
    await preco(personagem[0].id, 1)

    const pedido = {
      leaderVariantId: String(lider[0].id),
      lines: [{ variantId: String(personagem[0].id), copies: 1 }],
      autoComplete: true,
    }

    const semLider = await analyzeDeck(testPrisma(), dona, pedido)
    expect(semLider.leader).toMatchObject({ copies: 1, owned: 0, missing: 1, unitUsd: 12, missingUsd: 12 })
    expect(semLider.cost.usd).toBe(13)
    expect(semLider.total).toBe(2)

    const item = await own(dona.collectionId, lider[0].id, 1)
    const binder = await createStorage(dona.id, 'BINDER', 'COLLECTION', 'Líderes')
    await allocate(item.id, binder.id, 1)

    const comLider = await analyzeDeck(testPrisma(), dona, pedido)
    expect(comLider.leader).toMatchObject({ owned: 1, missing: 0, missingUsd: 0 })
    expect(comLider.leader.places).toEqual([{ location: 'Líderes', forTrade: false, quantity: 1 }])
    expect(comLider.cost.usd).toBe(1)
  })

  it('o auto completar vale para o líder: outra arte do mesmo líder conta', async () => {
    const dona = await pessoa()
    const { variants: lider } = await carta('OP01-001', 'Leader', ['Red'], ['Normal', 'Parallel'])
    const { variants: personagem } = await carta('OP01-016', 'Character', ['Red'])
    await own(dona.collectionId, lider[1].id, 1) // só tem a paralela

    const pedido = {
      leaderVariantId: String(lider[0].id),
      lines: [{ variantId: String(personagem[0].id), copies: 1 }],
    }

    expect((await analyzeDeck(testPrisma(), dona, { ...pedido, autoComplete: true })).leader.owned).toBe(1)
    expect((await analyzeDeck(testPrisma(), dona, { ...pedido, autoComplete: false })).leader.owned).toBe(0)
  })

  it('um deck completo são 51 cartas conferidas', async () => {
    const dona = await pessoa()
    const { variants: lider } = await carta('OP01-001', 'Leader', ['Red'])
    const linhas = []
    for (let i = 0; i < 13; i++) {
      const { variants } = await carta(`OP09-${String(i).padStart(3, '0')}`, 'Character', ['Red'])
      linhas.push({ variantId: String(variants[0].id), copies: i < 12 ? 4 : 2 })
    }

    const analise = await analyzeDeck(testPrisma(), dona, {
      leaderVariantId: String(lider[0].id),
      lines: linhas,
      autoComplete: true,
    })

    expect(analise.total).toBe(51)
    expect(analise.remaining).toBe(0)
    expect(analise.missingTotal).toBe(51)
  })
})
