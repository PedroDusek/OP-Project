import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { AuthenticatedUser } from '@/server/application/auth'
import { blockMember } from '@/server/application/social/network'
import { setOfferItem } from '@/server/application/trades/edit-offer'
import { getOpenTrade, getTrade } from '@/server/application/trades/read-trade'
import {
  acceptInvite,
  declineInvite,
  inviteMember,
  joinTrade,
  listReceivedInvites,
  startTrade,
} from '@/server/application/trades/start-trade'
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from '@/server/domain/errors'
import { createUser, disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * O convite direto para troca (decisão 082). O que mais importa: o consentimento
 * da regra 4.6.1 continua fechando no gesto de quem recebe — antes do aceite,
 * ninguém vê o cruzamento nem mexe na troca.
 */

async function pessoa(nome: string, username: string | null): Promise<AuthenticatedUser> {
  const criada = await createUser(nome)
  await testPrisma().user.update({ where: { id: criada.id }, data: { username } })
  return { id: criada.id, email: criada.email, name: nome, plan: 'FREE', premiumUntil: null }
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('convidar', () => {
  it('cria o convite para a pessoa, que o vê em Trocas; quem convidou vê o enviado', async () => {
    const ana = await pessoa('Ana Souza', 'ana')
    const bia = await pessoa('Bia Lima', 'bia')

    const tradeId = await inviteMember(testPrisma(), ana, 'BIA')

    expect(await listReceivedInvites(testPrisma(), bia)).toEqual([
      { tradeId: String(tradeId), fromUsername: 'ana', createdAt: expect.any(Date) },
    ])
    expect(await getOpenTrade(testPrisma(), ana)).toMatchObject({
      tradeId: String(tradeId),
      status: 'DRAFT',
      otherName: null,
      invitedUsername: 'bia',
      inviteToken: null,
    })
    // O convite recebido nao e troca aberta de quem recebeu.
    expect(await getOpenTrade(testPrisma(), bia)).toBeNull()
  })

  it('exige nome, alguém que exista, não é consigo mesmo, e um convite aberto por vez', async () => {
    const semNome = await pessoa('Sem nome', null)
    const ana = await pessoa('Ana', 'ana')
    await pessoa('Bia', 'bia')
    await pessoa('Caio', 'caio')

    await expect(inviteMember(testPrisma(), semNome, 'ana')).rejects.toThrow(ConflictError)
    await expect(inviteMember(testPrisma(), ana, 'ninguem')).rejects.toThrow(NotFoundError)
    await expect(inviteMember(testPrisma(), ana, 'ana')).rejects.toThrow(ValidationError)

    await inviteMember(testPrisma(), ana, 'bia')
    await expect(inviteMember(testPrisma(), ana, 'caio')).rejects.toThrow(/Descarte-o/)
  })

  it('o bloqueio em qualquer direção impede', async () => {
    const ana = await pessoa('Ana', 'ana')
    const bia = await pessoa('Bia', 'bia')
    await blockMember(testPrisma(), bia, 'ana')

    await expect(inviteMember(testPrisma(), ana, 'bia')).rejects.toThrow(AuthorizationError)
    await expect(inviteMember(testPrisma(), bia, 'ana')).rejects.toThrow(AuthorizationError)
  })
})

describe('antes do aceite', () => {
  /* Regra 4.6.1: o dado privado so se cruza com o consentimento das duas partes. */
  it('a convidada não vê nem mexe na troca, e quem convidou não vê o cruzamento', async () => {
    const ana = await pessoa('Ana', 'ana')
    const bia = await pessoa('Bia', 'bia')
    const tradeId = await inviteMember(testPrisma(), ana, 'bia')

    await expect(getTrade(testPrisma(), bia, tradeId)).rejects.toThrow(AuthorizationError)
    await expect(
      setOfferItem(testPrisma(), bia, tradeId, { cardVariantId: 1n, quantity: 1 }),
    ).rejects.toThrow(AuthorizationError)

    const vista = await getTrade(testPrisma(), ana, tradeId)
    expect(vista).toMatchObject({ other: null, invitedUsername: 'bia', iCanOffer: [], theyCanOffer: [] })
  })
})

describe('aceitar e recusar', () => {
  it('aceitar abre a negociação, e os dois aparecem pelo nome na rede', async () => {
    const ana = await pessoa('Ana Souza', 'ana')
    const bia = await pessoa('Bia Lima', 'bia')
    const tradeId = await inviteMember(testPrisma(), ana, 'bia')

    await acceptInvite(testPrisma(), bia, tradeId)

    const vista = await getTrade(testPrisma(), bia, tradeId)
    expect(vista.status).toBe('NEGOTIATING')
    // Regra 6.1.1: o nome na rede e a unica identidade que a outra pessoa ve.
    expect(vista.other?.name).toBe('@ana')
    expect((await getOpenTrade(testPrisma(), ana))?.otherName).toBe('@bia')
    expect(await listReceivedInvites(testPrisma(), bia)).toEqual([])
  })

  it('recusar cancela, e some para os dois', async () => {
    const ana = await pessoa('Ana', 'ana')
    const bia = await pessoa('Bia', 'bia')
    const tradeId = await inviteMember(testPrisma(), ana, 'bia')

    await declineInvite(testPrisma(), bia, tradeId)

    expect(await listReceivedInvites(testPrisma(), bia)).toEqual([])
    expect(await getOpenTrade(testPrisma(), ana)).toBeNull()
    await expect(acceptInvite(testPrisma(), bia, tradeId)).rejects.toThrow(NotFoundError)
  })

  it('só a convidada responde; quem convidou não aceita o próprio convite', async () => {
    const ana = await pessoa('Ana', 'ana')
    await pessoa('Bia', 'bia')
    const intrusa = await pessoa('Caio', 'caio')
    const tradeId = await inviteMember(testPrisma(), ana, 'bia')

    await expect(acceptInvite(testPrisma(), ana, tradeId)).rejects.toThrow(NotFoundError)
    await expect(acceptInvite(testPrisma(), intrusa, tradeId)).rejects.toThrow(NotFoundError)
    await expect(declineInvite(testPrisma(), intrusa, tradeId)).rejects.toThrow(NotFoundError)
  })

  /* Regra 4.5: uma troca ativa por vez, para as duas pessoas. */
  it('não aceita se alguma das duas já está em outra troca ativa', async () => {
    const ana = await pessoa('Ana', 'ana')
    const bia = await pessoa('Bia', 'bia')
    const caio = await pessoa('Caio', 'caio')
    const tradeId = await inviteMember(testPrisma(), ana, 'bia')

    // Ana entra noutra troca, pelo link de Caio, enquanto o convite espera.
    const { inviteToken } = await startTrade(testPrisma(), caio)
    await joinTrade(testPrisma(), ana, inviteToken)

    await expect(acceptInvite(testPrisma(), bia, tradeId)).rejects.toThrow(/outra troca/)
  })
})
