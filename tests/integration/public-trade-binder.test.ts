import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  getTradeBinderShare,
  publishTradeBinder,
  readPublicTradeBinder,
  revokeTradeBinder,
} from '@/server/application/trades/public-binder'
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
 * O Trade Binder publicado por link (regra 6.1).
 *
 * Esta e a **unica** pagina do produto que mostra dado de alguem sem sessao, e
 * por isso a maior parte destes testes verifica o que ela **nao** entrega. Um
 * campo a mais na consulta vaza para todo mundo que tiver o endereco, e nao ha
 * segunda barreira depois dela.
 */

type Person = { user: AuthenticatedUser; userId: bigint; collectionId: bigint }

async function person(name: string, username: string | null = null): Promise<Person> {
  const created = await createUser(name)
  if (username) {
    await testPrisma().user.update({ where: { id: created.id }, data: { username } })
  }

  return {
    userId: created.id,
    collectionId: created.collection!.id,
    user: {
      id: created.id,
      email: created.email,
      name,
      plan: 'FREE',
      premiumUntil: null,
    },
  }
}

/** Poe copias num local, e devolve a variante e o local. */
async function guardar(
  who: Person,
  quantity: number,
  purpose: 'TRADE' | 'COLLECTION',
  code?: string,
  local?: { id: bigint },
) {
  const { variant } = await createCardWithVariant('Character', code)
  const item = await own(who.collectionId, variant.id, quantity)
  const onde = local ?? (await createStorage(who.userId, 'BINDER', purpose))
  await allocate(item.id, onde.id, quantity)
  return { variant, item, local: onde }
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('publicar e revogar', () => {
  it('comeca sem link nenhum', async () => {
    const ana = await person('Ana', 'ana')

    expect(await getTradeBinderShare(testPrisma(), ana.user)).toEqual({
      token: null,
      publishedAt: null,
    })
  })

  it('publica com um token longo e aleatorio', async () => {
    const ana = await person('Ana', 'ana')

    const { token, publishedAt } = await publishTradeBinder(testPrisma(), ana.user)

    // Adivinhar um seria bisbilhotar o inventario de estranhos (decisao 056).
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(publishedAt).toBeInstanceOf(Date)
  })

  /*
   * A regra 6.1 diz que o token nunca e derivado de id interno. Substring nao
   * prova isso — a primeira versao deste teste procurava o id dentro do token e
   * passava sozinha, falhando na suite inteira quando o id virava `1` e o token
   * aleatorio continha um "1". Verde num contexto e vermelho no outro e o pior
   * tipo de teste.
   *
   * O que da para provar e a ausencia de correlacao: ids vizinhos produzem
   * tokens sem nada em comum.
   */
  it('nao correlaciona o token com o id de quem publica', async () => {
    const ana = await person('Ana', 'ana')
    const bruno = await person('Bruno', 'bruno')

    const dela = (await publishTradeBinder(testPrisma(), ana.user)).token!
    const dele = (await publishTradeBinder(testPrisma(), bruno.user)).token!

    expect(dela).not.toBe(dele)
    // Ids consecutivos, tokens sem prefixo comum.
    expect(bruno.userId - ana.userId).toBe(1n)
    expect(dela.slice(0, 8)).not.toBe(dele.slice(0, 8))
  })

  it('gerar de novo derruba o link anterior', async () => {
    const ana = await person('Ana', 'ana')

    const primeiro = await publishTradeBinder(testPrisma(), ana.user)
    const segundo = await publishTradeBinder(testPrisma(), ana.user)

    expect(segundo.token).not.toBe(primeiro.token)
    expect(await readPublicTradeBinder(testPrisma(), primeiro.token!)).toBeNull()
    expect(await readPublicTradeBinder(testPrisma(), segundo.token!)).not.toBeNull()
  })

  it('revogar apaga o link e a data juntos', async () => {
    const ana = await person('Ana', 'ana')
    const { token } = await publishTradeBinder(testPrisma(), ana.user)

    await revokeTradeBinder(testPrisma(), ana.user)

    expect(await getTradeBinderShare(testPrisma(), ana.user)).toEqual({
      token: null,
      publishedAt: null,
    })
    expect(await readPublicTradeBinder(testPrisma(), token!)).toBeNull()
  })

  /*
   * A regra 6.1.1 diz que o nome de usuario e a unica identidade que outros
   * veem. Sem ele, publicar produziria uma pagina de ninguem.
   */
  it('recusa publicar sem nome de usuario', async () => {
    const semNome = await person('Sem Nome')

    const erro = await publishTradeBinder(testPrisma(), semNome.user).catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(ConflictError)
    expect((erro as ConflictError).code).toBe('NOME_DE_USUARIO_NECESSARIO')
  })
})

describe('o que a pagina publica mostra', () => {
  it('mostra as cartas dos locais de troca, somadas num conjunto so', async () => {
    const ana = await person('Ana', 'ana')

    // A mesma carta em dois locais de troca aparece uma vez, com a soma: a
    // divisao entre binder e caixa e organizacao dela (decisao 064).
    const { variant } = await createCardWithVariant('Character', 'OP01-201')
    const item = await own(ana.collectionId, variant.id, 5)
    const binder = await createStorage(ana.userId, 'BINDER', 'TRADE')
    const caixa = await createStorage(ana.userId, 'BOX', 'TRADE')
    await allocate(item.id, binder.id, 3)
    await allocate(item.id, caixa.id, 2)

    const { token } = await publishTradeBinder(testPrisma(), ana.user)
    const publico = await readPublicTradeBinder(testPrisma(), token!)

    expect(publico!.username).toBe('ana')
    expect(publico!.cards).toHaveLength(1)
    expect(publico!.cards[0].quantity).toBe(5)
    expect(publico!.copies).toBe(5)
  })

  /* So `purpose = 'TRADE'` conta (regra 4.1 e 6.1). */
  it('nunca mostra o que esta em armazenamento de colecao', async () => {
    const ana = await person('Ana', 'ana')
    await guardar(ana, 2, 'TRADE', 'OP01-202')
    const guardada = await guardar(ana, 4, 'COLLECTION', 'OP01-203')

    const { token } = await publishTradeBinder(testPrisma(), ana.user)
    const publico = await readPublicTradeBinder(testPrisma(), token!)

    expect(publico!.cards).toHaveLength(1)
    expect(publico!.cards.map((c) => c.variantId)).not.toContain(String(guardada.variant.id))
  })

  /*
   * A lista do que a regra 6.1 proibe, verificada no objeto inteiro e nao campo
   * a campo: um campo novo acrescentado sem pensar cai aqui.
   */
  it('nao carrega nome real, e-mail nem nada da colecao', async () => {
    const ana = await person('Ana Sobrenome', 'ana')
    await guardar(ana, 2, 'TRADE', 'OP01-204')
    await guardar(ana, 9, 'COLLECTION', 'OP01-205')

    await testPrisma().wantItem.create({
      data: {
        userId: ana.userId,
        cardVariantId: (await createCardWithVariant('Character', 'OP01-206')).variant.id,
        quantity: 3,
      },
    })

    const { token } = await publishTradeBinder(testPrisma(), ana.user)
    const publico = await readPublicTradeBinder(testPrisma(), token!)

    const serializado = JSON.stringify(publico)
    expect(serializado).not.toContain('Ana Sobrenome')
    expect(serializado).not.toContain(ana.user.email)
    expect(serializado).not.toContain('OP01-205')
    expect(serializado).not.toContain('OP01-206')

    // As chaves sao exatamente as previstas, e nada alem.
    expect(Object.keys(publico!).sort()).toEqual([
      'cards',
      'copies',
      'publishedAt',
      'username',
    ])
  })

  /*
   * Quantas a pessoa possui ao todo aparece no Trade Binder de dentro do app,
   * para ela saber o que ficou de fora. Num link publico isso contaria a
   * estranhos o tamanho da colecao dela.
   */
  it('nao diz quantas copias a pessoa tem ao todo', async () => {
    const ana = await person('Ana', 'ana')
    const { variant } = await createCardWithVariant('Character', 'OP01-207')
    const item = await own(ana.collectionId, variant.id, 10)
    const binder = await createStorage(ana.userId, 'BINDER', 'TRADE')
    await allocate(item.id, binder.id, 2)

    const { token } = await publishTradeBinder(testPrisma(), ana.user)
    const publico = await readPublicTradeBinder(testPrisma(), token!)

    expect(publico!.cards[0].quantity).toBe(2)

    /*
     * As chaves da carta sao exatamente estas. Conferir a lista inteira, e nao
     * a ausencia de um nome, e o que faz um campo novo acrescentado sem pensar
     * cair aqui — foi assim que este teste comecou, procurando a string "10", e
     * casando com qualquer id ou data que a contivesse.
     */
    expect(Object.keys(publico!.cards[0]).sort()).toEqual([
      'cardCode',
      'cardName',
      'imageUrl',
      'quantity',
      'rarity',
      'variantId',
      'variantType',
    ])
  })

  it('mostra o binder vazio sem quebrar', async () => {
    const ana = await person('Ana', 'ana')
    const { token } = await publishTradeBinder(testPrisma(), ana.user)

    const publico = await readPublicTradeBinder(testPrisma(), token!)

    expect(publico!.cards).toEqual([])
    expect(publico!.copies).toBe(0)
  })

  it('nao mostra o Trade Binder de outra pessoa', async () => {
    const ana = await person('Ana', 'ana')
    const bruno = await person('Bruno', 'bruno')
    await guardar(ana, 2, 'TRADE', 'OP01-208')
    const dele = await guardar(bruno, 3, 'TRADE', 'OP01-209')

    const { token } = await publishTradeBinder(testPrisma(), ana.user)
    const publico = await readPublicTradeBinder(testPrisma(), token!)

    expect(publico!.cards.map((c) => c.variantId)).not.toContain(String(dele.variant.id))
  })
})

describe('token que nao vale', () => {
  /*
   * Token inexistente e token revogado dao a mesma resposta. Distinguir
   * contaria a quem tentasse que aquele link ja existiu.
   */
  it('nao encontra token inventado, vazio ou revogado', async () => {
    const ana = await person('Ana', 'ana')
    const { token } = await publishTradeBinder(testPrisma(), ana.user)
    await revokeTradeBinder(testPrisma(), ana.user)

    expect(await readPublicTradeBinder(testPrisma(), 'inventado')).toBeNull()
    expect(await readPublicTradeBinder(testPrisma(), '')).toBeNull()
    expect(await readPublicTradeBinder(testPrisma(), '   ')).toBeNull()
    expect(await readPublicTradeBinder(testPrisma(), token!)).toBeNull()
  })

  /* Conta anonimizada nao publica nada (decisao 015). */
  it('nao encontra o binder de conta anonimizada', async () => {
    const ana = await person('Ana', 'ana')
    await guardar(ana, 2, 'TRADE', 'OP01-210')
    const { token } = await publishTradeBinder(testPrisma(), ana.user)

    await testPrisma().user.update({
      where: { id: ana.userId },
      data: { deletedAt: new Date() },
    })

    expect(await readPublicTradeBinder(testPrisma(), token!)).toBeNull()
  })
})
