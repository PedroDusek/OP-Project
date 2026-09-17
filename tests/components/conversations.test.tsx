import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversationThread } from '@/components/conversations/conversation-thread'
import { StartConversationButton } from '@/components/conversations/start-conversation'
import { NotificationBell } from '@/components/layout/notification-bell'

/*
 * As acoes gravam no banco: aqui sao dubles. A regra — uma conversa por par, o
 * bloqueio, ler marca lido — esta em `tests/integration/conversations.test.ts`.
 */
const { sendMessageAction, startConversationAction, refresh } = vi.hoisted(() => ({
  sendMessageAction: vi.fn(async (_previous: unknown, _data: FormData) => ({ status: 'sent' as const, at: 1 })),
  startConversationAction: vi.fn(async (_previous: unknown, _data: FormData) => ({
    status: 'error' as const,
    message: 'Não é possível enviar mensagens para esta pessoa.',
  })),
  refresh: vi.fn(),
}))
vi.mock('@/app/(app)/conversas/actions', () => ({ sendMessageAction, startConversationAction }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }), usePathname: () => '/conversas' }))

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ lastMessageId: '1', sendBlocked: null }))))
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

/**
 * As conversas na interface (decisão 081). O que se protege: de quem é cada
 * mensagem, o envio com o campo que esvazia, o aviso no lugar do campo quando não
 * dá para escrever, e o aviso de mensagem no sino.
 */

const mensagens = [
  { id: '1', body: 'Oi! Você troca a OP01-001?', createdAt: new Date('2026-09-16T15:00:00Z'), mine: false },
  { id: '2', body: 'Troco sim.', createdAt: new Date('2026-09-16T15:01:00Z'), mine: true },
]

describe('a conversa', () => {
  it('mostra as mensagens em ordem, e manda o texto para a ação', async () => {
    const user = userEvent.setup()
    render(<ConversationThread conversationId="9" messages={mensagens} sendBlocked={null} otherUsername="ana" />)

    const itens = within(screen.getByRole('list', { name: 'Mensagens com @ana' })).getAllByRole('listitem')
    expect(itens[0]).toHaveTextContent('Oi! Você troca a OP01-001?')
    expect(itens[1]).toHaveTextContent('Você, ')
    expect(itens[1]).toHaveTextContent('Troco sim.')
    // Decisao 084: o proprio balao se alinha — o jsdom nao desenha, entao se
    // protege a classe que alinha, e nao a posicao.
    expect(itens[0]).toHaveClass('self-start')
    expect(itens[1]).toHaveClass('self-end')
    // No Brave do iPhone a classe nao bastou: o estilo no elemento e o que garante.
    expect(itens[1]).toHaveStyle({ alignSelf: 'flex-end', maxWidth: '80%' })
    expect(itens[0]).toHaveStyle({ alignSelf: 'flex-start' })

    const campo = screen.getByRole('textbox', { name: 'Mensagem' })
    const enviar = screen.getByRole('button', { name: 'Enviar mensagem' })
    expect(enviar).toBeDisabled()

    await user.type(campo, 'Fechado, amanhã?')
    await user.click(enviar)

    const data = sendMessageAction.mock.calls[0][1]
    expect(data.get('conversa')).toBe('9')
    expect(data.get('mensagem')).toBe('Fechado, amanhã?')
    expect(campo).toHaveValue('')
  })

  it('sem poder escrever, mostra o motivo no lugar do campo', () => {
    render(
      <ConversationThread
        conversationId="9"
        messages={mensagens}
        sendBlocked="Você bloqueou esta pessoa. Desbloqueie para voltar a conversar."
        otherUsername="ana"
      />,
    )
    expect(screen.queryByRole('textbox', { name: 'Mensagem' })).not.toBeInTheDocument()
    expect(screen.getByText(/Desbloqueie para voltar a conversar/)).toBeInTheDocument()
  })

  it('pergunta pelo estado da conversa aberta', async () => {
    render(<ConversationThread conversationId="9" messages={[]} sendBlocked={null} otherUsername="ana" />)
    expect(screen.getByText(/Nenhuma mensagem ainda/)).toBeInTheDocument()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/conversas/9/estado', { cache: 'no-store' }))
  })
})

describe('mandar mensagem a partir do binder', () => {
  it('manda o nome para a ação, e mostra a recusa', async () => {
    const user = userEvent.setup()
    render(<StartConversationButton username="ana" />)

    await user.click(screen.getByRole('button', { name: 'Mandar mensagem' }))
    expect(startConversationAction.mock.calls[0][1].get('username')).toBe('ana')
    expect(await screen.findByRole('alert')).toHaveTextContent('Não é possível enviar mensagens para esta pessoa.')
  })
})

describe('o sino com mensagem', () => {
  it('avisa da mensagem e leva às conversas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ notices: [{ kind: 'unread-messages', conversations: 1 }] }))),
    )
    const user = userEvent.setup()
    render(<NotificationBell />)

    await user.click(await screen.findByRole('button', { name: 'Notificações, 1 pendente' }))
    const aviso = await screen.findByRole('link', { name: /Você recebeu uma mensagem/ })
    expect(aviso).toHaveAttribute('href', '/conversas')
  })
})
