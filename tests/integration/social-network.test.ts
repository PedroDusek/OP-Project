import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedUser } from '@/server/application/auth'
import {
  blockMember,
  listBlockedMembers,
  listNetwork,
  readMemberBinder,
  reportMember,
  unblockMember,
} from '@/server/application/social/network'
import { listReports } from '@/server/application/social/reports'
import { NotFoundError, RateLimitError, ValidationError } from '@/server/domain/errors'
import { NETWORK_PAGE_SIZE } from '@/server/domain/social/network'
import { resetRateLimits } from '@/server/http/rate-limit'
import {
  allocate,
  createCard,
  createStorage,
  createUser,
  createVariant,
  disconnect,
  own,
  resetDatabase,
  testPrisma,
} from '../helpers'

/**
 * A rede (regras 6.1.2 a 6.1.4, decisões 060 e 079).
 *
 * O que mais importa aqui é o que **não** aparece: a want list de outra pessoa,
 * o que ela guarda fora da troca, quem não tem nome, quem saiu, e quem foi
 * bloqueado por quem olha.
 */

type Pessoa = { user: AuthenticatedUser; id: bigint; collectionId: bigint }

async function pessoa(nome: string, username: string | null, extra: { plan?: string } = {}): Promise<Pessoa> {
  const criada = await createUser(nome)
  await testPrisma().user.update({
    where: { id: criada.id },
    data: { username, ...(extra.plan ? { plan: extra.plan } : {}) },
  })
  return {
    id: criada.id,
    collectionId: criada.collection!.id,
    user: { id: criada.id, email: criada.email, name: nome, plan: extra.plan ?? 'FREE', premiumUntil: null },
  }
}

async function carta(code: string, name = `Carta ${code}`) {
  const card = await createCard('Character', code)
  await testPrisma().card.update({ where: { id: card.id }, data: { name } })
  return createVariant(card.id)
}

async function guardar(dono: Pessoa, variantId: bigint, quantidade: number, purpose: 'TRADE' | 'COLLECTION' = 'TRADE') {
  const item = await own(dono.collectionId, variantId, quantidade)
  const local = await createStorage(dono.id, 'BINDER', purpose)
  await allocate(item.id, local.id, quantidade)
}

async function querer(quem: Pessoa, variantId: bigint, quantidade = 1) {
  await testPrisma().wantItem.create({ data: { userId: quem.id, cardVariantId: variantId, quantity: quantidade } })
}

const nomes = (page: Awaited<ReturnType<typeof listNetwork>>) => page.members.map((m) => m.username)

beforeEach(async () => {
  await resetDatabase()
  resetRateLimits()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

afterAll(async () => {
  await disconnect()
})

describe('quem aparece na rede', () => {
  it('só quem tem nome, cartas em local de troca e não é quem olha', async () => {
    const eu = await pessoa('Eu', 'eu')
    const ana = await pessoa('Ana', 'ana')
    const semNome = await pessoa('Sem nome', null)
    const soColecao = await pessoa('Bia', 'bia')
    const saiu = await pessoa('Caio', 'caio')
    const zoro = await carta('OP01-001')

    await guardar(eu, zoro.id, 1)
    await guardar(ana, zoro.id, 2)
    await guardar(semNome, zoro.id, 1)
    await guardar(soColecao, zoro.id, 4, 'COLLECTION')
    await guardar(saiu, zoro.id, 1)
    await testPrisma().user.update({ where: { id: saiu.id }, data: { deletedAt: new Date() } })

    expect(nomes(await listNetwork(testPrisma(), eu.user))).toEqual(['ana'])
  })

  it('não mostra quem olha bloqueou, e o bloqueio é numa direção só', async () => {
    const eu = await pessoa('Eu', 'eu')
    const ana = await pessoa('Ana', 'ana')
    const zoro = await carta('OP01-001')
    await guardar(eu, zoro.id, 1)
    await guardar(ana, zoro.id, 1)

    await blockMember(testPrisma(), eu.user, 'ana')

    expect(nomes(await listNetwork(testPrisma(), eu.user))).toEqual([])
    // A regra 6.1.4 esconde quem foi bloqueado de quem bloqueou, e so isso.
    expect(nomes(await listNetwork(testPrisma(), ana.user))).toEqual(['eu'])

    await unblockMember(testPrisma(), eu.user, 'ana')
    expect(nomes(await listNetwork(testPrisma(), eu.user))).toEqual(['ana'])
  })
})

describe('a ordem', () => {
  /* Regra 6.1.3: Premium primeiro, e o desempate e o interesse de quem olha. */
  it('Premium primeiro, depois quem tem mais cartas que quem olha procura', async () => {
    const eu = await pessoa('Eu', 'eu')
    const [a, b, c] = [await carta('OP01-001'), await carta('OP01-002'), await carta('OP01-003')]
    await querer(eu, a.id)
    await querer(eu, b.id)

    const bruno = await pessoa('Bruno', 'bruno')
    await guardar(bruno, c.id, 1)
    const clara = await pessoa('Clara', 'clara')
    await guardar(clara, a.id, 1)
    await guardar(clara, b.id, 1)
    const davi = await pessoa('Davi', 'davi')
    await guardar(davi, a.id, 1)
    const premium = await pessoa('Premium', 'zeca', { plan: 'PREMIUM' })
    await guardar(premium, c.id, 1)

    const rede = await listNetwork(testPrisma(), eu.user)
    expect(nomes(rede)).toEqual(['zeca', 'clara', 'davi', 'bruno'])
    expect(rede.members.map((m) => [m.premium, m.interest])).toEqual([
      [true, 0],
      [false, 2],
      [false, 1],
      [false, 0],
    ])
  })

  /* O want que a colecao ja cobre nao conta como interesse. */
  it('o want já satisfeito não conta', async () => {
    const eu = await pessoa('Eu', 'eu')
    const a = await carta('OP01-001')
    await querer(eu, a.id, 1)
    await own(eu.collectionId, a.id, 1)
    const ana = await pessoa('Ana', 'ana')
    await guardar(ana, a.id, 1)

    const [membro] = (await listNetwork(testPrisma(), eu.user)).members
    expect(membro.interest).toBe(0)
    expect(membro.preview[0].wanted).toBe(false)
  })

  it('a prévia traz primeiro o que quem olha procura', async () => {
    const eu = await pessoa('Eu', 'eu')
    const cartas = []
    for (let i = 1; i <= 9; i++) cartas.push(await carta(`OP01-00${i}`))
    await querer(eu, cartas[8].id)
    const ana = await pessoa('Ana', 'ana')
    for (const c of cartas) await guardar(ana, c.id, 1)

    const [membro] = (await listNetwork(testPrisma(), eu.user)).members
    expect(membro.cards).toBe(9)
    expect(membro.preview).toHaveLength(7)
    expect(membro.preview[0]).toMatchObject({ cardCode: 'OP01-009', wanted: true })
    expect(membro.preview[1].cardCode).toBe('OP01-001')
  })
})

describe('a busca por carta', () => {
  it('devolve só quem tem a carta, e a mostra primeiro na prévia', async () => {
    const eu = await pessoa('Eu', 'eu')
    const zoro = await carta('OP01-001', 'Roronoa Zoro')
    const nami = await carta('OP01-016', 'Nami')
    const ana = await pessoa('Ana', 'ana')
    await guardar(ana, nami.id, 1)
    await guardar(ana, zoro.id, 1)
    const bia = await pessoa('Bia', 'bia')
    await guardar(bia, nami.id, 1)

    const rede = await listNetwork(testPrisma(), eu.user, { query: '  zoro ' })
    expect(rede.query).toBe('zoro')
    expect(nomes(rede)).toEqual(['ana'])
    expect(rede.members[0].preview[0]).toMatchObject({ cardCode: 'OP01-001', matching: true })

    expect(nomes(await listNetwork(testPrisma(), eu.user, { query: 'OP01-016' }))).toEqual(['ana', 'bia'])
    expect(nomes(await listNetwork(testPrisma(), eu.user, { query: 'Luffy' }))).toEqual([])
  })

  /* A busca e o gesto que serve a busca de alvo: cota mais apertada (decisao 060). */
  it('a busca tem cota própria, mais apertada que a listagem', async () => {
    const eu = await pessoa('Eu', 'eu')
    await carta('OP01-001', 'Roronoa Zoro')
    for (let i = 0; i < 20; i++) await listNetwork(testPrisma(), eu.user, { query: 'zoro' })
    await expect(listNetwork(testPrisma(), eu.user, { query: 'zoro' })).rejects.toThrow(RateLimitError)
    await expect(listNetwork(testPrisma(), eu.user)).resolves.toBeDefined()
  })
})

describe('as páginas', () => {
  it('carrega até a página pedida, e diz se há mais', async () => {
    const eu = await pessoa('Eu', 'eu')
    const zoro = await carta('OP01-001')
    for (let i = 0; i < NETWORK_PAGE_SIZE + 3; i++) {
      const p = await pessoa(`P${i}`, `pessoa${String(i).padStart(2, '0')}`)
      await guardar(p, zoro.id, 1)
    }

    const primeira = await listNetwork(testPrisma(), eu.user)
    expect(primeira.members).toHaveLength(NETWORK_PAGE_SIZE)
    expect(primeira.hasMore).toBe(true)

    const segunda = await listNetwork(testPrisma(), eu.user, { page: '2' })
    expect(segunda.members).toHaveLength(NETWORK_PAGE_SIZE + 3)
    expect(segunda.hasMore).toBe(false)
  })
})

describe('o Trade Binder de alguém', () => {
  it('mostra só o que está em troca, com o que quem olha procura marcado', async () => {
    const eu = await pessoa('Eu', 'eu')
    const [a, b] = [await carta('OP01-001'), await carta('OP01-002')]
    await querer(eu, b.id)
    const ana = await pessoa('Ana', 'ana')
    await guardar(ana, a.id, 2)
    await guardar(ana, b.id, 1)
    await guardar(ana, (await carta('OP01-003')).id, 5, 'COLLECTION')
    await querer(ana, a.id, 3)

    const binder = await readMemberBinder(testPrisma(), eu.user, 'ANA')
    expect(binder).toMatchObject({ username: 'ana', blocked: false, copies: 3, interest: 1 })
    expect(binder!.cards.map((c) => [c.cardCode, c.quantity, c.wanted])).toEqual([
      ['OP01-001', 2, false],
      ['OP01-002', 1, true],
    ])
    // Nada da want list dela, nem do que ela guarda fora da troca.
    expect(JSON.stringify(binder)).not.toContain('OP01-003')
  })

  it('bloqueado: não mostra as cartas', async () => {
    const eu = await pessoa('Eu', 'eu')
    const ana = await pessoa('Ana', 'ana')
    await guardar(ana, (await carta('OP01-001')).id, 1)
    await blockMember(testPrisma(), eu.user, 'ana')

    expect(await readMemberBinder(testPrisma(), eu.user, 'ana')).toMatchObject({ blocked: true, cards: [] })
    expect(await listBlockedMembers(testPrisma(), eu.user)).toEqual([{ username: 'ana', since: expect.any(Date) }])
  })

  it('nome que não existe e conta que saiu são a mesma resposta; o próprio nome é nulo', async () => {
    const eu = await pessoa('Eu', 'eu')
    const saiu = await pessoa('Caio', 'caio')
    await testPrisma().user.update({ where: { id: saiu.id }, data: { deletedAt: new Date() } })

    await expect(readMemberBinder(testPrisma(), eu.user, 'ninguem')).rejects.toThrow(NotFoundError)
    await expect(readMemberBinder(testPrisma(), eu.user, 'caio')).rejects.toThrow(NotFoundError)
    expect(await readMemberBinder(testPrisma(), eu.user, 'eu')).toBeNull()
  })
})

describe('bloquear e denunciar', () => {
  it('bloquear duas vezes não é erro, e ninguém bloqueia a si mesmo', async () => {
    const eu = await pessoa('Eu', 'eu')
    await pessoa('Ana', 'ana')
    await blockMember(testPrisma(), eu.user, 'ana')
    await blockMember(testPrisma(), eu.user, 'ana')
    expect(await testPrisma().userBlock.count()).toBe(1)
    await expect(blockMember(testPrisma(), eu.user, 'eu')).rejects.toThrow(ValidationError)
  })

  it('a denúncia exige motivo, e chega a quem administra — só a ele', async () => {
    const eu = await pessoa('Eu', 'eu')
    const ana = await pessoa('Ana', 'ana')

    await expect(reportMember(testPrisma(), eu.user, 'ana', '   ')).rejects.toThrow(ValidationError)
    await expect(reportMember(testPrisma(), eu.user, 'eu', 'motivo')).rejects.toThrow(ValidationError)
    await reportMember(testPrisma(), eu.user, 'ana', '  Pediu pagamento adiantado.  ')

    await expect(listReports(testPrisma(), eu.user)).rejects.toThrow(NotFoundError)

    vi.stubEnv('ADMIN_EMAILS', `outra@example.test, ${eu.user.email.toUpperCase()}`)
    const [denuncia] = await listReports(testPrisma(), eu.user)
    expect(denuncia).toMatchObject({
      reason: 'Pediu pagamento adiantado.',
      reporter: { username: 'eu' },
      reported: { username: 'ana', email: ana.user.email },
    })
  })
})
