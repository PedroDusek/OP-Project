import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { purgeAllAccounts, surveyAccounts } from '@/server/application/account/purge-accounts'
import { startConversation, sendMessage } from '@/server/application/social/conversations'
import type { AuthAdmin, AuthUserDirectory } from '@/server/http/auth-admin'
import type { ImageStorage } from '@/server/http/image-storage'
import { resetRateLimits } from '@/server/http/rate-limit'
import type { AuthenticatedUser } from '@/server/application/auth'
import {
  allocate,
  createCardWithVariant,
  createUser,
  disconnect,
  own,
  resetDatabase,
  testPrisma,
} from '../helpers'

/**
 * Zerar os usuários antes do teste com gente de verdade (19/09).
 *
 * O que se protege: sai tudo o que é de pessoa — inclusive o que a exclusão
 * normal preserva, como trocas, conversas e denúncias —, e o catálogo fica.
 */

let noProvedor: { id: string; email: string | null }[] = []
let excluidasNoAuth: string[] = []
const authAdmin: AuthAdmin = {
  name: 'falso',
  available: true,
  deleteUser: async (id) => void excluidasNoAuth.push(id),
}
const directory: AuthUserDirectory = { listUsers: async () => noProvedor }

let fotosRemovidas: string[] = []
const images: ImageStorage = {
  name: 'falso',
  available: true,
  upload: async () => ({ url: 'https://exemplo.test/foto.jpg' }),
  remove: async (url) => void fotosRemovidas.push(url),
}

async function pessoa(nome: string, username: string): Promise<AuthenticatedUser & { collectionId: bigint }> {
  const criada = await createUser(nome)
  await testPrisma().user.update({ where: { id: criada.id }, data: { username, authUserId: `auth-${username}` } })
  return {
    id: criada.id,
    email: criada.email,
    name: nome,
    plan: 'FREE',
    premiumUntil: null,
    collectionId: criada.collection!.id,
  }
}

beforeEach(async () => {
  await resetDatabase()
  resetRateLimits()
  excluidasNoAuth = []
  fotosRemovidas = []
  noProvedor = []
})

afterAll(async () => {
  await disconnect()
})

async function cenario() {
  const ana = await pessoa('Ana', 'ana')
  const bia = await pessoa('Bia', 'bia')
  const { variant } = await createCardWithVariant()

  const local = await testPrisma().storageLocation.create({
    data: { userId: ana.id, type: 'BINDER', purpose: 'TRADE', name: 'Binder', image: 'https://storage.test/ana.jpg' },
  })
  const item = await own(ana.collectionId, variant.id, 3)
  await allocate(item.id, local.id, 3)
  await testPrisma().wantItem.create({ data: { userId: bia.id, cardVariantId: variant.id, quantity: 1 } })
  await testPrisma().trade.create({
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      participants: { create: [{ userId: ana.id, role: 'INITIATOR' }, { userId: bia.id, role: 'RECIPIENT' }] },
    },
  })
  await testPrisma().userReport.create({ data: { reporterId: bia.id, reportedId: ana.id, reason: 'Teste.' } })
  const conversa = await startConversation(testPrisma(), bia, 'ana')
  await sendMessage(testPrisma(), ana, conversa, 'Oi!')
  await testPrisma().userBlock.create({ data: { blockerId: ana.id, blockedId: bia.id } })

  // No provedor há uma conta a mais: um cadastro que nunca confirmou o e-mail.
  noProvedor = [
    { id: 'auth-ana', email: ana.email },
    { id: 'auth-bia', email: bia.email },
    { id: 'auth-sem-confirmar', email: 'nunca@confirmou.test' },
  ]
  return { ana, bia, variant }
}

describe('surveyAccounts', () => {
  it('mostra o que seria apagado, sem apagar nada', async () => {
    const { ana } = await cenario()

    const survey = await surveyAccounts(testPrisma(), directory)

    expect(survey.users).toHaveLength(2)
    expect(survey.users.find((u) => u.email === ana.email)).toMatchObject({ cards: 1, locations: 1, wants: 0 })
    expect(survey).toMatchObject({ trades: 1, conversations: 1, reports: 1, authUsers: 3, images: 1 })
    expect(await testPrisma().user.count()).toBe(2)
    expect(excluidasNoAuth).toEqual([])
  })
})

describe('purgeAllAccounts', () => {
  it('apaga todas as contas e tudo o que é de pessoa, mesmo o que a exclusão normal preserva', async () => {
    await cenario()

    const report = await purgeAllAccounts(testPrisma(), { authAdmin, directory, images })

    expect(report).toMatchObject({ users: 2, trades: 1, conversations: 1, reports: 1, authDeleted: 3, authFailed: 0 })
    const db = testPrisma()
    const restantes = await Promise.all([
      db.user.count(),
      db.collection.count(),
      db.collectionItem.count(),
      db.collectionItemLocation.count(),
      db.storageLocation.count(),
      db.wantItem.count(),
      db.trade.count(),
      db.tradeParticipant.count(),
      db.conversation.count(),
      db.message.count(),
      db.userReport.count(),
      db.userBlock.count(),
    ])
    expect(restantes).toEqual(Array(12).fill(0))
  })

  it('apaga no provedor também quem nunca ganhou linha no banco', async () => {
    await cenario()

    await purgeAllAccounts(testPrisma(), { authAdmin, directory, images })

    expect(excluidasNoAuth.sort()).toEqual(['auth-ana', 'auth-bia', 'auth-sem-confirmar'])
  })

  it('remove as fotos dos binders', async () => {
    await cenario()

    const report = await purgeAllAccounts(testPrisma(), { authAdmin, directory, images })

    expect(fotosRemovidas).toEqual(['https://storage.test/ana.jpg'])
    expect(report.imagesRemoved).toBe(1)
  })

  it('deixa o catálogo', async () => {
    const { variant } = await cenario()

    await purgeAllAccounts(testPrisma(), { authAdmin, directory, images })

    expect(await testPrisma().cardVariant.findUnique({ where: { id: variant.id } })).not.toBeNull()
  })

  /* O banco antes do provedor: rodar de novo termina o que o provedor não fez. */
  it('conta a falha do provedor sem desfazer o banco', async () => {
    await cenario()
    const falhando: AuthAdmin = { ...authAdmin, deleteUser: async () => { throw new Error('fora do ar') } }

    const report = await purgeAllAccounts(testPrisma(), { authAdmin: falhando, directory, images })

    expect(report).toMatchObject({ users: 2, authDeleted: 0, authFailed: 3 })
    expect(await testPrisma().user.count()).toBe(0)
  })
})
