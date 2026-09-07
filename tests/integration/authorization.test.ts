import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  assertOwnedBy,
  assertPermitted,
  isPremium,
  ownedBy,
} from '@/server/application/authorization'
import type { AuthenticatedUser } from '@/server/application/auth/resolve-user'
import { AuthorizationError, NotFoundError } from '@/server/domain/errors'
import { createStorage, createUser, disconnect, resetDatabase, testPrisma } from '../helpers'

function asAuthenticated(user: { id: bigint; email: string; name: string }): AuthenticatedUser {
  return { ...user, plan: 'FREE', premiumUntil: null }
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('escopo por dono na consulta', () => {
  it('so devolve os recursos do proprio usuario', async () => {
    const db = testPrisma()
    const mine = await createUser('Meu')
    const theirs = await createUser('Outro')
    await createStorage(mine.id, 'BINDER', 'COLLECTION', 'Meu binder')
    await createStorage(theirs.id, 'BINDER', 'COLLECTION', 'Binder alheio')

    const visible = await db.storageLocation.findMany({ where: ownedBy(asAuthenticated(mine)) })

    expect(visible).toHaveLength(1)
    expect(visible[0].name).toBe('Meu binder')
  })

  it('buscar recurso alheio pelo id devolve nada, e nao um 403', async () => {
    // Escopar a consulta e melhor que verificar depois: com o filtro do dono, um
    // id alheio simplesmente nao existe. Verificar depois responderia 403 para
    // recurso alheio e 404 para inexistente, e essa diferenca conta quantos
    // binders o vizinho tem.
    const db = testPrisma()
    const mine = await createUser('Meu')
    const theirs = await createUser('Outro')
    const foreign = await createStorage(theirs.id, 'BOX', 'TRADE')

    const found = await db.storageLocation.findFirst({
      where: { id: foreign.id, ...ownedBy(asAuthenticated(mine)) },
    })

    expect(found).toBeNull()
  })

  it('nao deixa alterar recurso alheio nem quando o id e conhecido', async () => {
    const db = testPrisma()
    const mine = await createUser('Meu')
    const theirs = await createUser('Outro')
    const foreign = await createStorage(theirs.id, 'BINDER', 'TRADE', 'Original')

    const changed = await db.storageLocation.updateMany({
      where: { id: foreign.id, ...ownedBy(asAuthenticated(mine)) },
      data: { name: 'Invadido' },
    })

    expect(changed.count).toBe(0)
    const untouched = await db.storageLocation.findUniqueOrThrow({ where: { id: foreign.id } })
    expect(untouched.name).toBe('Original')
  })
})

describe('conferencia de dono em linha ja carregada', () => {
  it('aceita a propria linha', async () => {
    const mine = await createUser()
    expect(() => assertOwnedBy({ userId: mine.id }, asAuthenticated(mine))).not.toThrow()
  })

  it('trata linha alheia como inexistente, nao como proibida', async () => {
    const mine = await createUser('Meu')
    const theirs = await createUser('Outro')
    expect(() => assertOwnedBy({ userId: theirs.id }, asAuthenticated(mine))).toThrow(NotFoundError)
  })

  it('trata ausencia como inexistente', async () => {
    const mine = await createUser()
    expect(() => assertOwnedBy(null, asAuthenticated(mine))).toThrow(NotFoundError)
  })
})

describe('negar acao sobre recurso visivel', () => {
  it('permite quando a condicao vale', () => {
    expect(() => assertPermitted(true)).not.toThrow()
  })

  it('nega com 403, porque esconder seria mentira', () => {
    // Aqui a pessoa ve o recurso; o que se recusa e a operacao.
    expect(() => assertPermitted(false)).toThrow(AuthorizationError)
  })
})

describe('acesso Premium', () => {
  const agora = new Date('2026-09-06T12:00:00Z')

  it('nega para plano FREE', () => {
    expect(isPremium({ plan: 'FREE', premiumUntil: null }, agora)).toBe(false)
  })

  it('nega Premium ja vencido', () => {
    expect(isPremium({ plan: 'PREMIUM', premiumUntil: new Date('2026-09-01') }, agora)).toBe(false)
  })

  it('aceita Premium dentro do prazo', () => {
    expect(isPremium({ plan: 'PREMIUM', premiumUntil: new Date('2026-10-01') }, agora)).toBe(true)
  })

  it('aceita Premium sem prazo', () => {
    expect(isPremium({ plan: 'PREMIUM', premiumUntil: null }, agora)).toBe(true)
  })
})
