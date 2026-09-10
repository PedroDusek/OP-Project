import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getUsernameState, setUsername } from '@/server/application/social/set-username'
import type { AuthenticatedUser } from '@/server/application/auth'
import { createUser, disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * O nome de usuario contra o banco.
 *
 * A validacao esta em `tests/domain/username.test.ts`, sem banco. Aqui se
 * verifica o que so o banco pode dizer: que dois nao levam o mesmo nome, que a
 * troca respeita a semana, e que escolher pela primeira vez nao gasta a cota.
 */

const SEMANA = 7 * 24 * 60 * 60 * 1000

async function pessoa(nome: string): Promise<AuthenticatedUser> {
  const criada = await createUser(nome)
  return {
    id: criada.id,
    email: `${nome.toLowerCase()}@example.test`,
    name: nome,
    plan: 'FREE',
    premiumUntil: null,
  }
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('escolher', () => {
  it('grava o nome normalizado', async () => {
    const ana = await pessoa('Ana')

    const resultado = await setUsername(testPrisma(), ana, '  Ana_TCG  ')

    expect(resultado.username).toBe('ana_tcg')
    expect((await getUsernameState(testPrisma(), ana)).username).toBe('ana_tcg')
  })

  /** Cobrar uma semana de espera de quem acabou de chegar seria punir o comeco. */
  it('a primeira escolha nao gasta a cota semanal', async () => {
    const ana = await pessoa('Ana')

    const resultado = await setUsername(testPrisma(), ana, 'ana')

    expect(resultado.nextChangeAt).toBeNull()
    await expect(setUsername(testPrisma(), ana, 'ana2')).resolves.toBeTruthy()
  })

  it('recusa nome invalido antes de tocar no banco', async () => {
    const ana = await pessoa('Ana')

    await expect(setUsername(testPrisma(), ana, 'a')).rejects.toThrow(/pelo menos/i)
    expect((await getUsernameState(testPrisma(), ana)).username).toBeNull()
  })

  it('devolve nulo para quem ainda nao escolheu', async () => {
    const ana = await pessoa('Ana')

    expect(await getUsernameState(testPrisma(), ana)).toEqual({
      username: null,
      nextChangeAt: null,
    })
  })
})

describe('unico em toda a rede', () => {
  it('recusa nome que ja e de outra pessoa', async () => {
    const ana = await pessoa('Ana')
    const bruno = await pessoa('Bruno')
    await setUsername(testPrisma(), ana, 'zoro')

    await expect(setUsername(testPrisma(), bruno, 'zoro')).rejects.toThrow(/já está em uso/i)
  })

  /**
   * A unicidade e do banco, e nao de uma consulta antes de gravar: duas pessoas
   * pedindo o mesmo nome ao mesmo tempo passariam as duas pela consulta.
   */
  it('recusa a variacao de caixa do nome de outra pessoa', async () => {
    const ana = await pessoa('Ana')
    const bruno = await pessoa('Bruno')
    await setUsername(testPrisma(), ana, 'zoro')

    await expect(setUsername(testPrisma(), bruno, 'ZORO')).rejects.toThrow(/já está em uso/i)
  })
})

describe('trocar', () => {
  it('recusa a segunda troca dentro da semana', async () => {
    const ana = await pessoa('Ana')
    await setUsername(testPrisma(), ana, 'ana')
    await setUsername(testPrisma(), ana, 'ana2')

    await expect(setUsername(testPrisma(), ana, 'ana3')).rejects.toThrow(/uma vez por semana/i)
  })

  it('libera depois de uma semana', async () => {
    const ana = await pessoa('Ana')
    await setUsername(testPrisma(), ana, 'ana')
    await setUsername(testPrisma(), ana, 'ana2')

    const daqui = new Date(Date.now() + SEMANA + 1000)
    await expect(setUsername(testPrisma(), ana, 'ana3', daqui)).resolves.toMatchObject({
      username: 'ana3',
    })
  })

  /** Salvar o formulario sem ter mexido nele nao pode gastar a cota. */
  it('pedir o nome que ja se tem nao conta como troca', async () => {
    const ana = await pessoa('Ana')
    await setUsername(testPrisma(), ana, 'ana')
    await setUsername(testPrisma(), ana, 'ana2')

    await expect(setUsername(testPrisma(), ana, 'ANA2')).resolves.toMatchObject({
      username: 'ana2',
    })
  })

  it('diz quando vai liberar, para a tela poder contar', async () => {
    const ana = await pessoa('Ana')
    await setUsername(testPrisma(), ana, 'ana')
    const trocou = await setUsername(testPrisma(), ana, 'ana2')

    expect(trocou.nextChangeAt).toBeInstanceOf(Date)
    expect((await getUsernameState(testPrisma(), ana)).nextChangeAt).toBeInstanceOf(Date)
  })
})
