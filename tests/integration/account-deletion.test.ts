import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedUser } from '@/server/application/auth'
import { resolveUser } from '@/server/application/auth/resolve-user'
import {
  anonymizeDueAccounts,
  cancelAccountDeletion,
  requestAccountDeletion,
} from '@/server/application/account/delete-account'
import { readConversation, startConversation, sendMessage } from '@/server/application/social/conversations'
import { listNetwork, readMemberBinder } from '@/server/application/social/network'
import { readPublicTradeBinder } from '@/server/application/trades/public-binder'
import { NotFoundError, ValidationError } from '@/server/domain/errors'
import type { AuthAdmin } from '@/server/http/auth-admin'
import type { ImageStorage } from '@/server/http/image-storage'
import type { EmailMessage, Mailer } from '@/server/http/mailer'
import { resetRateLimits } from '@/server/http/rate-limit'
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
 * Excluir a conta (decisões 015 e 091).
 *
 * Regras do dono do produto: 30 dias para desistir, entrar de novo cancela, as
 * trocas em andamento são canceladas no pedido, as mensagens enviadas ficam, e
 * o nome na rede fica livre na anonimização.
 */

const DIA = 24 * 60 * 60 * 1000

let enviados: EmailMessage[] = []
const mailer: Mailer = { name: 'memoria', available: true, send: async (m) => void enviados.push(m) }

let excluidasNoAuth: string[] = []
const authAdmin: AuthAdmin = {
  name: 'falso',
  available: true,
  deleteUser: async (id) => void excluidasNoAuth.push(id),
}

let fotosRemovidas: string[] = []
const images: ImageStorage = {
  name: 'falso',
  available: true,
  upload: async () => ({ url: 'https://exemplo.test/foto.jpg' }),
  remove: async (url) => void fotosRemovidas.push(url),
}

async function pessoa(nome: string, username: string): Promise<AuthenticatedUser & { authUserId: string; collectionId: bigint }> {
  const criada = await createUser(nome)
  const authUserId = `auth-${username}`
  await testPrisma().user.update({ where: { id: criada.id }, data: { username, authUserId } })
  return {
    id: criada.id,
    email: criada.email,
    name: nome,
    plan: 'FREE',
    premiumUntil: null,
    authUserId,
    collectionId: criada.collection!.id,
  }
}

async function troca(status: string, a: bigint, b: bigint, inviteToken: string | null = null) {
  return testPrisma().trade.create({
    data: {
      status,
      inviteToken,
      completedAt: status === 'COMPLETED' ? new Date() : null,
      participants: {
        create: [
          { userId: a, role: 'INITIATOR' },
          { userId: b, role: 'RECIPIENT' },
        ],
      },
    },
  })
}

const pedir = (user: AuthenticatedUser, now = new Date()) =>
  requestAccountDeletion(testPrisma(), { mailer, appUrl: 'https://colexa.com.br', now }, user, 'EXCLUIR')

beforeEach(async () => {
  await resetDatabase()
  resetRateLimits()
  enviados = []
  excluidasNoAuth = []
  fotosRemovidas = []
})

afterAll(async () => {
  await disconnect()
})

describe('pedir a exclusão', () => {
  it('exige a palavra de confirmação, sem ligar para maiúsculas', async () => {
    const ana = await pessoa('Ana', 'ana')
    const deps = { mailer, appUrl: 'https://colexa.com.br' }

    await expect(requestAccountDeletion(testPrisma(), deps, ana, 'sim')).rejects.toThrow(ValidationError)
    expect((await testPrisma().user.findUniqueOrThrow({ where: { id: ana.id } })).deletionRequestedAt).toBeNull()

    await requestAccountDeletion(testPrisma(), deps, ana, '  excluir ')
    expect((await testPrisma().user.findUniqueOrThrow({ where: { id: ana.id } })).deletionRequestedAt).not.toBeNull()
  })

  it('suspende a conta: não autentica mais, e o prazo é de 30 dias', async () => {
    const ana = await pessoa('Ana', 'ana')
    const agora = new Date('2026-09-17T12:00:00Z')

    const { dueAt } = await pedir(ana, agora)

    expect(dueAt).toEqual(new Date('2026-10-17T12:00:00Z'))
    expect(await resolveUser(testPrisma(), { authUserId: ana.authUserId, email: ana.email })).toBeNull()
  })

  it('cancela as trocas em andamento, e deixa as concluídas', async () => {
    const ana = await pessoa('Ana', 'ana')
    const bia = await pessoa('Bia', 'bia')
    const caio = await pessoa('Caio', 'caio')

    const rascunho = await troca('DRAFT', ana.id, bia.id, 'token-convite')
    const negociando = await troca('NEGOTIATING', bia.id, ana.id)
    const concluida = await troca('COMPLETED', ana.id, bia.id)
    const deOutros = await troca('NEGOTIATING', bia.id, caio.id)

    await pedir(ana)

    const status = async (id: bigint) => testPrisma().trade.findUniqueOrThrow({ where: { id } })
    expect(await status(rascunho.id)).toMatchObject({ status: 'CANCELLED', inviteToken: null })
    expect((await status(negociando.id)).status).toBe('CANCELLED')
    expect((await status(concluida.id)).status).toBe('COMPLETED')
    expect((await status(deOutros.id)).status).toBe('NEGOTIATING')
  })

  it('manda o e-mail com a data e como desistir, e e-mail que falha não desfaz o pedido', async () => {
    const ana = await pessoa('Ana', 'ana')
    await pedir(ana, new Date('2026-09-17T12:00:00Z'))

    expect(enviados).toHaveLength(1)
    expect(enviados[0].to).toBe(ana.email)
    expect(enviados[0].text).toContain('17 de outubro de 2026')
    expect(enviados[0].text).toContain('https://colexa.com.br/entrar')

    const bia = await pessoa('Bia', 'bia')
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const quebrado: Mailer = { name: 'quebrado', available: true, send: async () => { throw new Error('fora') } }
    await requestAccountDeletion(testPrisma(), { mailer: quebrado, appUrl: 'https://x.test' }, bia, 'EXCLUIR')
    expect((await testPrisma().user.findUniqueOrThrow({ where: { id: bia.id } })).deletionRequestedAt).not.toBeNull()
    erro.mockRestore()
  })

  it('a conta suspensa some da rede, do binder e do link público, e não recebe mensagem', async () => {
    const ana = await pessoa('Ana', 'ana')
    const bia = await pessoa('Bia', 'bia')

    const { variant } = await createCardWithVariant()
    const local = await createStorage(ana.id, 'BINDER', 'TRADE')
    const item = await own(ana.collectionId, variant.id, 1)
    await allocate(item.id, local.id, 1)
    await testPrisma().user.update({
      where: { id: ana.id },
      data: { tradeBinderToken: 'link-publico', tradeBinderTokenCreatedAt: new Date() },
    })
    const conversa = await startConversation(testPrisma(), bia, 'ana')

    expect((await listNetwork(testPrisma(), bia)).members.map((m) => m.username)).toEqual(['ana'])

    await pedir(ana)

    expect((await listNetwork(testPrisma(), bia)).members).toEqual([])
    await expect(readMemberBinder(testPrisma(), bia, 'ana')).rejects.toThrow(NotFoundError)
    expect(await readPublicTradeBinder(testPrisma(), 'link-publico')).toBeNull()
    await expect(startConversation(testPrisma(), bia, 'ana')).rejects.toThrow(NotFoundError)

    const vista = await readConversation(testPrisma(), bia, conversa)
    expect(vista.sendBlocked).toBe('Esta conta não está disponível no momento.')
    await expect(sendMessage(testPrisma(), bia, conversa, 'Oi?')).rejects.toThrow()
  })
})

describe('desistir entrando de novo', () => {
  it('entrar cancela o pedido e devolve a conta; sem pedido, não muda nada', async () => {
    const ana = await pessoa('Ana', 'ana')
    await pedir(ana)

    expect(await cancelAccountDeletion(testPrisma(), ana.authUserId)).toBe(true)
    expect(await resolveUser(testPrisma(), { authUserId: ana.authUserId, email: ana.email })).toMatchObject({ id: ana.id })
    expect(await cancelAccountDeletion(testPrisma(), ana.authUserId)).toBe(false)
  })

  it('conta já anonimizada não volta entrando', async () => {
    const ana = await pessoa('Ana', 'ana')
    await pedir(ana, new Date(Date.now() - 31 * DIA))
    await anonymizeDueAccounts(testPrisma(), { authAdmin, images })

    expect(await cancelAccountDeletion(testPrisma(), ana.authUserId)).toBe(false)
  })
})

describe('anonimizar quem venceu o prazo', () => {
  it('só quem pediu há mais de 30 dias', async () => {
    const vencida = await pessoa('Vencida', 'vencida')
    const noPrazo = await pessoa('No prazo', 'noprazo')
    const agora = new Date('2026-10-20T12:00:00Z')

    await pedir(vencida, new Date(agora.getTime() - 30 * DIA - 1000))
    await pedir(noPrazo, new Date(agora.getTime() - 29 * DIA))

    const report = await anonymizeDueAccounts(testPrisma(), { authAdmin, images, now: agora })

    expect(report).toEqual({ due: 1, anonymized: 1, failed: 0 })
    expect(excluidasNoAuth).toEqual(['auth-vencida'])
    expect((await testPrisma().user.findUniqueOrThrow({ where: { id: noPrazo.id } })).deletedAt).toBeNull()
  })

  it('apaga o dado pessoal e o que é só dela, e preserva o que é da outra pessoa também', async () => {
    const ana = await pessoa('Ana', 'ana')
    const bia = await pessoa('Bia', 'bia')

    const { variant } = await createCardWithVariant()
    const local = await testPrisma().storageLocation.create({
      data: { userId: ana.id, type: 'BINDER', purpose: 'TRADE', name: 'Binder', image: 'https://storage.test/ana.jpg' },
    })
    const item = await own(ana.collectionId, variant.id, 2)
    await allocate(item.id, local.id, 2)
    await testPrisma().wantItem.create({ data: { userId: ana.id, cardVariantId: variant.id, quantity: 1 } })
    await testPrisma().userBlock.create({ data: { blockerId: bia.id, blockedId: ana.id } })
    await testPrisma().userReport.create({ data: { reporterId: bia.id, reportedId: ana.id, reason: 'Sumiu.' } })
    await testPrisma().user.update({
      where: { id: ana.id },
      data: { tradeBinderToken: 'link', tradeBinderTokenCreatedAt: new Date(), plan: 'PREMIUM', premiumUntil: new Date() },
    })
    const concluida = await troca('COMPLETED', ana.id, bia.id)
    await testPrisma().userBlock.deleteMany()
    const conversa = await startConversation(testPrisma(), bia, 'ana')
    await sendMessage(testPrisma(), ana, conversa, 'Combinado, sábado.')

    await pedir(ana, new Date(Date.now() - 31 * DIA))
    const report = await anonymizeDueAccounts(testPrisma(), { authAdmin, images })
    expect(report.anonymized).toBe(1)

    const conta = await testPrisma().user.findUniqueOrThrow({ where: { id: ana.id } })
    expect(conta).toMatchObject({
      name: 'Conta excluída',
      email: `deleted+${ana.id}@deleted.invalid`,
      authUserId: null,
      username: null,
      tradeBinderToken: null,
      plan: 'FREE',
      premiumUntil: null,
      deletionRequestedAt: null,
    })
    expect(conta.deletedAt).not.toBeNull()

    expect(await testPrisma().collection.count({ where: { userId: ana.id } })).toBe(0)
    expect(await testPrisma().collectionItem.count()).toBe(0)
    expect(await testPrisma().storageLocation.count({ where: { userId: ana.id } })).toBe(0)
    expect(await testPrisma().wantItem.count({ where: { userId: ana.id } })).toBe(0)
    expect(fotosRemovidas).toEqual(['https://storage.test/ana.jpg'])

    // Da outra pessoa tambem: a troca concluida, a mensagem e a denuncia.
    expect((await testPrisma().trade.findUniqueOrThrow({ where: { id: concluida.id } })).status).toBe('COMPLETED')
    expect(await testPrisma().message.findMany({ select: { body: true } })).toEqual([{ body: 'Combinado, sábado.' }])
    expect(await testPrisma().userReport.count()).toBe(1)

    // O nome na rede fica livre na hora.
    const nova = await createUser('Nova')
    await expect(testPrisma().user.update({ where: { id: nova.id }, data: { username: 'ana' } })).resolves.toBeTruthy()

    // A conversa continua aberta para a Bia, sem nome do outro lado.
    const vista = await readConversation(testPrisma(), bia, conversa)
    expect(vista.otherUsername).toBeNull()
    expect(vista.messages.map((m) => m.body)).toEqual(['Combinado, sábado.'])
  })

  it('sem a chave de administração, não anonimiza ninguém', async () => {
    const ana = await pessoa('Ana', 'ana')
    await pedir(ana, new Date(Date.now() - 31 * DIA))

    const semChave: AuthAdmin = { name: 'sem', available: false, deleteUser: vi.fn() }
    await expect(anonymizeDueAccounts(testPrisma(), { authAdmin: semChave, images })).rejects.toThrow('SUPABASE_SECRET_KEY')
    expect((await testPrisma().user.findUniqueOrThrow({ where: { id: ana.id } })).deletedAt).toBeNull()
  })

  it('falha no Auth deixa a conta para a próxima execução, e não derruba as outras', async () => {
    const ana = await pessoa('Ana', 'ana')
    const bia = await pessoa('Bia', 'bia')
    await pedir(ana, new Date(Date.now() - 31 * DIA))
    await pedir(bia, new Date(Date.now() - 31 * DIA))

    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const instavel: AuthAdmin = {
      name: 'instavel',
      available: true,
      deleteUser: async (id) => {
        if (id === 'auth-ana') throw new Error('503')
      },
    }
    const report = await anonymizeDueAccounts(testPrisma(), { authAdmin: instavel, images })
    erro.mockRestore()

    expect(report).toEqual({ due: 2, anonymized: 1, failed: 1 })
    expect((await testPrisma().user.findUniqueOrThrow({ where: { id: ana.id } })).deletedAt).toBeNull()
    expect((await testPrisma().user.findUniqueOrThrow({ where: { id: bia.id } })).deletedAt).not.toBeNull()

    // Na execucao seguinte, a Ana vai.
    expect(await anonymizeDueAccounts(testPrisma(), { authAdmin, images })).toEqual({ due: 1, anonymized: 1, failed: 0 })
  })

  it('o banco recusa conta anonimizada com pedido pendente', async () => {
    const ana = await pessoa('Ana', 'ana')
    await expect(
      testPrisma().user.update({ where: { id: ana.id }, data: { deletedAt: new Date(), deletionRequestedAt: new Date() } }),
    ).rejects.toThrow()
  })
})
