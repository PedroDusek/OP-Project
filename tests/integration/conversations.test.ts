import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { AuthenticatedUser } from '@/server/application/auth'
import { readNotices } from '@/server/application/notifications/notices'
import {
  conversationState,
  countUnreadConversations,
  listConversations,
  readConversation,
  sendMessage,
  startConversation,
} from '@/server/application/social/conversations'
import { blockMember, unblockMember } from '@/server/application/social/network'
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from '@/server/domain/errors'
import { resetRateLimits } from '@/server/http/rate-limit'
import { createUser, disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * As conversas (decisão 081). O que mais importa: uma conversa por par, só quem
 * participa lê ou escreve, o bloqueio impede escrever, e ler apaga o aviso.
 */

async function pessoa(nome: string, username: string | null): Promise<AuthenticatedUser> {
  const criada = await createUser(nome)
  await testPrisma().user.update({ where: { id: criada.id }, data: { username } })
  return { id: criada.id, email: criada.email, name: nome, plan: 'FREE', premiumUntil: null }
}

beforeEach(async () => {
  await resetDatabase()
  resetRateLimits()
})

afterAll(async () => {
  await disconnect()
})

describe('abrir uma conversa', () => {
  it('uma conversa por par, não importa quem abre', async () => {
    const ana = await pessoa('Ana', 'ana')
    const bia = await pessoa('Bia', 'bia')

    const primeira = await startConversation(testPrisma(), ana, 'bia')
    const deNovo = await startConversation(testPrisma(), ana, 'BIA')
    const peloOutroLado = await startConversation(testPrisma(), bia, 'ana')

    expect(deNovo).toBe(primeira)
    expect(peloOutroLado).toBe(primeira)
    expect(await testPrisma().conversation.count()).toBe(1)
    expect(await testPrisma().conversationParticipant.count()).toBe(2)
  })

  it('exige nome na rede, alguém que exista, e não é consigo mesmo', async () => {
    const semNome = await pessoa('Sem nome', null)
    const ana = await pessoa('Ana', 'ana')

    await expect(startConversation(testPrisma(), semNome, 'ana')).rejects.toThrow(ConflictError)
    await expect(startConversation(testPrisma(), ana, 'ninguem')).rejects.toThrow(NotFoundError)
    await expect(startConversation(testPrisma(), ana, 'ana')).rejects.toThrow(ValidationError)
  })

  /* Regra 6.1.4: quem foi bloqueado nao inicia conversa com quem bloqueou. */
  it('quem foi bloqueado não abre conversa, e quem bloqueou também não', async () => {
    const ana = await pessoa('Ana', 'ana')
    const bia = await pessoa('Bia', 'bia')
    await blockMember(testPrisma(), ana, 'bia')

    await expect(startConversation(testPrisma(), bia, 'ana')).rejects.toThrow(AuthorizationError)
    await expect(startConversation(testPrisma(), ana, 'bia')).rejects.toThrow(AuthorizationError)
  })

  it('a conversa vazia não aparece na lista', async () => {
    const ana = await pessoa('Ana', 'ana')
    await pessoa('Bia', 'bia')
    await startConversation(testPrisma(), ana, 'bia')
    expect(await listConversations(testPrisma(), ana)).toEqual([])
  })
})

describe('mensagens', () => {
  it('envia, lista da mais recente, e marca não lida só para quem recebe', async () => {
    const ana = await pessoa('Ana', 'ana')
    const bia = await pessoa('Bia', 'bia')
    const caio = await pessoa('Caio', 'caio')

    const comBia = await startConversation(testPrisma(), ana, 'bia')
    await sendMessage(testPrisma(), ana, comBia, '  Oi! Você troca a OP01-001?  ')
    const comCaio = await startConversation(testPrisma(), caio, 'ana')
    await sendMessage(testPrisma(), caio, comCaio, 'Tenho a Nami que você procura.')

    const lista = await listConversations(testPrisma(), ana)
    expect(lista.map((c) => [c.otherUsername, c.snippet, c.lastFromMe, c.unread])).toEqual([
      ['caio', 'Tenho a Nami que você procura.', false, true],
      ['bia', 'Oi! Você troca a OP01-001?', true, false],
    ])
    expect(await countUnreadConversations(testPrisma(), bia)).toBe(1)
    expect(await countUnreadConversations(testPrisma(), ana)).toBe(1)
  })

  it('ler marca lido, e o aviso do sino some', async () => {
    const ana = await pessoa('Ana', 'ana')
    const bia = await pessoa('Bia', 'bia')
    const conversa = await startConversation(testPrisma(), ana, 'bia')
    await sendMessage(testPrisma(), ana, conversa, 'Oi')

    expect(await readNotices(testPrisma(), bia)).toEqual([{ kind: 'unread-messages', conversations: 1 }])

    const vista = await readConversation(testPrisma(), bia, conversa)
    expect(vista).toMatchObject({ otherUsername: 'ana', sendBlocked: null })
    expect(vista.messages.map((m) => [m.body, m.mine])).toEqual([['Oi', false]])

    expect(await readNotices(testPrisma(), bia)).toEqual([])
  })

  /* O relogio de quem le pode estar atras do de quem gravou a mensagem. */
  it('ler apaga o aviso mesmo com o relógio de quem lê atrasado', async () => {
    const ana = await pessoa('Ana', 'ana')
    const bia = await pessoa('Bia', 'bia')
    const conversa = await startConversation(testPrisma(), ana, 'bia')
    await sendMessage(testPrisma(), ana, conversa, 'Oi', new Date('2026-09-16T12:00:10Z'))

    await readConversation(testPrisma(), bia, conversa, new Date('2026-09-16T12:00:00Z'))
    expect(await countUnreadConversations(testPrisma(), bia)).toBe(0)
  })

  it('mensagem vazia ou longa demais é recusada', async () => {
    const ana = await pessoa('Ana', 'ana')
    await pessoa('Bia', 'bia')
    const conversa = await startConversation(testPrisma(), ana, 'bia')

    await expect(sendMessage(testPrisma(), ana, conversa, '   ')).rejects.toThrow(ValidationError)
    await expect(sendMessage(testPrisma(), ana, conversa, 'x'.repeat(1001))).rejects.toThrow(ValidationError)
  })

  it('quem não participa não lê nem escreve, e a resposta é a de conversa que não existe', async () => {
    const ana = await pessoa('Ana', 'ana')
    await pessoa('Bia', 'bia')
    const intrusa = await pessoa('Caio', 'caio')
    const conversa = await startConversation(testPrisma(), ana, 'bia')

    await expect(readConversation(testPrisma(), intrusa, conversa)).rejects.toThrow(NotFoundError)
    await expect(sendMessage(testPrisma(), intrusa, conversa, 'oi')).rejects.toThrow(NotFoundError)
    await expect(conversationState(testPrisma(), intrusa, conversa)).rejects.toThrow(NotFoundError)
    await expect(readConversation(testPrisma(), ana, 999999n)).rejects.toThrow(NotFoundError)
  })

  /* Estendido com aprovacao do dono do produto: o bloqueio tambem vale na conversa que ja existia. */
  it('o bloqueio impede escrever nos dois sentidos, e as mensagens antigas ficam', async () => {
    const ana = await pessoa('Ana', 'ana')
    const bia = await pessoa('Bia', 'bia')
    const conversa = await startConversation(testPrisma(), ana, 'bia')
    await sendMessage(testPrisma(), bia, conversa, 'Oi')
    await blockMember(testPrisma(), ana, 'bia')

    await expect(sendMessage(testPrisma(), bia, conversa, 'Oi de novo')).rejects.toThrow(AuthorizationError)
    await expect(sendMessage(testPrisma(), ana, conversa, 'Tchau')).rejects.toThrow(AuthorizationError)

    const vistaDeAna = await readConversation(testPrisma(), ana, conversa)
    expect(vistaDeAna).toMatchObject({ viewerBlockedOther: true })
    expect(vistaDeAna.sendBlocked).toMatch(/Desbloqueie/)
    expect(vistaDeAna.messages).toHaveLength(1)
    expect((await readConversation(testPrisma(), bia, conversa)).sendBlocked).not.toBeNull()

    await unblockMember(testPrisma(), ana, 'bia')
    await expect(sendMessage(testPrisma(), bia, conversa, 'Oi de novo')).resolves.toMatchObject({ mine: true })
  })

  it('o estado muda quando chega mensagem, sem marcar lido', async () => {
    const ana = await pessoa('Ana', 'ana')
    const bia = await pessoa('Bia', 'bia')
    const conversa = await startConversation(testPrisma(), ana, 'bia')

    expect(await conversationState(testPrisma(), bia, conversa)).toEqual({ lastMessageId: null, sendBlocked: null })
    const enviada = await sendMessage(testPrisma(), ana, conversa, 'Oi')
    expect((await conversationState(testPrisma(), bia, conversa)).lastMessageId).toBe(enviada.id)
    expect(await countUnreadConversations(testPrisma(), bia)).toBe(1)
  })

  it('a conta que saiu não recebe mais mensagens', async () => {
    const ana = await pessoa('Ana', 'ana')
    const bia = await pessoa('Bia', 'bia')
    const conversa = await startConversation(testPrisma(), ana, 'bia')
    await sendMessage(testPrisma(), ana, conversa, 'Oi')
    await testPrisma().user.update({ where: { id: bia.id }, data: { deletedAt: new Date() } })

    const vista = await readConversation(testPrisma(), ana, conversa)
    expect(vista).toMatchObject({ otherUsername: null, sendBlocked: 'Esta conta saiu da rede.' })
    await expect(sendMessage(testPrisma(), ana, conversa, 'Oi?')).rejects.toThrow(AuthorizationError)
  })
})
