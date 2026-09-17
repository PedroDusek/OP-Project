import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { resolveUser } from '@/server/application/auth/resolve-user'
import { disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * A conta nasce no primeiro acesso de uma sessão válida.
 *
 * Relatado pelo dono do produto: o primeiro login de toda conta nova dava tela de
 * erro, e recarregar resolvia. A página e o sino resolvem a mesma sessão ao mesmo
 * tempo; a segunda criação batia no índice único de `auth_user_id`.
 */

const identidade = { authUserId: 'auth-novo', email: 'Nova@Example.TEST', name: 'Nova Pessoa' }

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('resolveUser', () => {
  it('cria a conta e a coleção no primeiro acesso, e devolve a mesma depois', async () => {
    const primeira = await resolveUser(testPrisma(), identidade)
    expect(primeira).toMatchObject({ email: 'nova@example.test', name: 'Nova Pessoa', plan: 'FREE' })

    const segunda = await resolveUser(testPrisma(), identidade)
    expect(segunda?.id).toBe(primeira?.id)
    expect(await testPrisma().collection.count({ where: { userId: primeira!.id } })).toBe(1)
  })

  it('vários acessos simultâneos no primeiro login dão a mesma conta, sem erro', async () => {
    const resultados = await Promise.all(Array.from({ length: 6 }, () => resolveUser(testPrisma(), identidade)))

    const ids = new Set(resultados.map((user) => user?.id))
    expect(ids.size).toBe(1)
    expect(await testPrisma().user.count()).toBe(1)
    expect(await testPrisma().collection.count()).toBe(1)
  })

  it('e-mail que já pertence a outra identidade continua sendo erro', async () => {
    await resolveUser(testPrisma(), identidade)
    await expect(
      resolveUser(testPrisma(), { authUserId: 'outra-identidade', email: 'nova@example.test' }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('conta anonimizada não autentica', async () => {
    const conta = await resolveUser(testPrisma(), identidade)
    await testPrisma().user.update({ where: { id: conta!.id }, data: { deletedAt: new Date() } })
    expect(await resolveUser(testPrisma(), identidade)).toBeNull()
  })
})
