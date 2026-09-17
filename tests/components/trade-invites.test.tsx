import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InviteMemberButton } from '@/components/trades/invite-member'
import { OpenTradeCard } from '@/components/trades/open-trade-card'
import { ReceivedInvites } from '@/components/trades/received-invites'

/*
 * As acoes gravam no banco: aqui sao dubles. A regra — consentimento no aceite,
 * uma troca ativa por vez — esta em `tests/integration/trade-invites.test.ts`.
 */
const { inviteMemberAction, acceptInviteAction, declineInviteAction, cancelTradeAction } = vi.hoisted(() => ({
  inviteMemberAction: vi.fn(async (_previous: unknown, _data: FormData) => ({
    status: 'error' as const,
    message: 'Você já tem um convite de troca aberto em Trocas. Descarte-o antes de convidar outra pessoa.',
  })),
  acceptInviteAction: vi.fn(async (_previous: unknown, _data: FormData) => ({ status: 'done' as const })),
  declineInviteAction: vi.fn(async (_previous: unknown, _data: FormData) => ({ status: 'done' as const })),
  cancelTradeAction: vi.fn(async (_previous: unknown, _data: FormData) => ({ status: 'done' as const })),
}))
vi.mock('@/app/(app)/trocas/actions', () => ({
  inviteMemberAction,
  acceptInviteAction,
  declineInviteAction,
  cancelTradeAction,
}))

afterEach(() => {
  vi.clearAllMocks()
})

/**
 * O convite direto na interface (decisão 082): o botão no binder, os convites
 * recebidos com aceitar e recusar, e o convite enviado sem troca para abrir.
 */

describe('convidar a partir do binder', () => {
  it('manda o nome para a ação, e mostra a recusa', async () => {
    const user = userEvent.setup()
    render(<InviteMemberButton username="ana" />)

    await user.click(screen.getByRole('button', { name: 'Convidar para trocar' }))
    expect(inviteMemberAction.mock.calls[0][1].get('username')).toBe('ana')
    expect(await screen.findByRole('alert')).toHaveTextContent(/Descarte-o/)
  })
})

describe('os convites recebidos', () => {
  const convite = { tradeId: '7', fromUsername: 'ana', createdAt: new Date() }

  it('não aparece sem convite', () => {
    const { container } = render(<ReceivedInvites invites={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('diz quem convidou, e manda a troca para aceitar ou recusar', async () => {
    const user = userEvent.setup()
    render(<ReceivedInvites invites={[convite]} />)

    const secao = within(screen.getByRole('region', { name: 'Convites de troca recebidos' }))
    expect(secao.getByRole('link', { name: '@ana' })).toHaveAttribute('href', '/social/ana')

    await user.click(secao.getByRole('button', { name: 'Aceitar' }))
    expect(acceptInviteAction.mock.calls[0][1].get('tradeId')).toBe('7')

    await user.click(secao.getByRole('button', { name: 'Recusar' }))
    expect(declineInviteAction.mock.calls[0][1].get('tradeId')).toBe('7')
  })
})

describe('o convite enviado', () => {
  it('diz para quem foi, não tem troca para abrir, e pode ser descartado', () => {
    render(
      <OpenTradeCard
        trade={{
          tradeId: '7',
          status: 'DRAFT',
          otherName: null,
          inviteToken: null,
          invitedUsername: 'bia',
          reviewRequested: false,
          exchanged: false,
        }}
        appUrl="https://colexa.com.br"
      />,
    )

    expect(screen.getByRole('heading', { name: 'Convite enviado para @bia' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Abrir a troca' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Link do convite')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descartar este convite' })).toBeInTheDocument()
  })
})
