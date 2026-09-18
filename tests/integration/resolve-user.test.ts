import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { emailBelongsToAnotherAccount } from '@/server/application/auth/email-conflict'
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

  /*
   * A regra mudou com a decisao 097: antes, o e-mail de outra identidade subia
   * como erro e derrubava a pagina. Agora o login recusa isso com mensagem
   * clara, e se uma sessao assim chegar ate aqui, ela e tratada como quem nao
   * entrou — sem criar conta repetida e sem tela de erro.
   */
  it('e-mail que já pertence a outra identidade não cria conta, e não derruba a página', async () => {
    await resolveUser(testPrisma(), identidade)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(
      resolveUser(testPrisma(), { authUserId: 'outra-identidade', email: 'nova@example.test' }),
    ).resolves.toBeNull()
    expect(await testPrisma().user.count()).toBe(1)
    warn.mockRestore()
  })

  it('confere se o e-mail já é de outra conta (decisão 097)', async () => {
    await resolveUser(testPrisma(), identidade)

    expect(await emailBelongsToAnotherAccount(testPrisma(), 'outra-identidade', ' NOVA@example.test ')).toBe(true)
    expect(await emailBelongsToAnotherAccount(testPrisma(), identidade.authUserId, 'nova@example.test')).toBe(false)
    expect(await emailBelongsToAnotherAccount(testPrisma(), 'outra-identidade', 'livre@example.test')).toBe(false)
  })

  it('conta anonimizada não autentica', async () => {
    const conta = await resolveUser(testPrisma(), identidade)
    await testPrisma().user.update({ where: { id: conta!.id }, data: { deletedAt: new Date() } })
    expect(await resolveUser(testPrisma(), identidade)).toBeNull()
  })
})
