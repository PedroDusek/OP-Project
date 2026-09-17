import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendMessageAction, startConversationAction } from '@/app/(app)/conversas/actions'
import { SEND_MESSAGE_IDLE, START_CONVERSATION_IDLE } from '@/app/(app)/conversas/state'
import { AuthorizationError } from '@/server/domain/errors'

/* O caso de uso grava no banco: aqui e duble. A regra esta em `tests/integration/conversations.test.ts`. */
const { sendMessage, startConversation, currentViewer, revalidatePath, redirect } = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  startConversation: vi.fn(),
  currentViewer: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))
vi.mock('@/server/application/social', () => ({ sendMessage, startConversation }))
vi.mock('@/server/http/viewer', () => ({ currentViewer }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/navigation', () => ({ redirect }))

const eu = { id: 1n, email: 'eu@example.test', name: 'Eu', plan: 'FREE', premiumUntil: null }

const form = (campos: Record<string, string>) => {
  const data = new FormData()
  for (const [nome, valor] of Object.entries(campos)) data.append(nome, valor)
  return data
}

beforeEach(() => {
  vi.clearAllMocks()
  currentViewer.mockResolvedValue(eu)
})

describe('as ações das conversas', () => {
  it('abrir leva para a conversa', async () => {
    startConversation.mockResolvedValue(42n)
    await expect(startConversationAction(START_CONVERSATION_IDLE, form({ username: 'ana' }))).rejects.toThrow(
      'NEXT_REDIRECT',
    )
    expect(startConversation).toHaveBeenCalledWith(eu, 'ana')
    expect(redirect).toHaveBeenCalledWith('/conversas/42')
  })

  it('abrir mostra a recusa do caso de uso', async () => {
    startConversation.mockRejectedValue(new AuthorizationError('Não é possível enviar mensagens para esta pessoa.'))
    const r = await startConversationAction(START_CONVERSATION_IDLE, form({ username: 'ana' }))
    expect(r).toEqual({ status: 'error', message: 'Não é possível enviar mensagens para esta pessoa.' })
    expect(redirect).not.toHaveBeenCalled()
  })

  it('enviar chama o caso de uso com quem está na sessão', async () => {
    const r = await sendMessageAction(SEND_MESSAGE_IDLE, form({ conversa: '42', mensagem: 'Oi' }))
    expect(sendMessage).toHaveBeenCalledWith(eu, 42n, 'Oi')
    expect(revalidatePath).toHaveBeenCalledWith('/conversas/42')
    expect(r.status).toBe('sent')
  })

  it('conversa inválida não chama nada', async () => {
    const r = await sendMessageAction(SEND_MESSAGE_IDLE, form({ conversa: 'abc', mensagem: 'Oi' }))
    expect(sendMessage).not.toHaveBeenCalled()
    expect(r).toEqual({ status: 'error', message: 'Conversa inválida.' })
  })
})
