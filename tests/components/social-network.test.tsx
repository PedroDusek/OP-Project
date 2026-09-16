import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BlockedList } from '@/components/social/blocked-list'
import { BlockToggle, ReportForm } from '@/components/social/member-actions'
import { NetworkMemberBox } from '@/components/social/network-member'
import type { NetworkMember } from '@/server/application/social'

/*
 * As acoes gravam no banco: aqui sao dubles. A regra — quem aparece, a ordem, o
 * bloqueio numa direcao so — esta em `tests/integration/social-network.test.ts`.
 */
const { blockMemberAction, unblockMemberAction, reportMemberAction } = vi.hoisted(() => {
  const feito = (message: string) => vi.fn(async (_previous: unknown, _data: FormData) => ({ status: 'done' as const, message }))
  return {
    blockMemberAction: feito('@ana foi bloqueado.'),
    unblockMemberAction: feito('@ana foi desbloqueado.'),
    reportMemberAction: feito('Denúncia enviada. Obrigado por avisar.'),
  }
})
vi.mock('@/app/(app)/social/actions', () => ({ blockMemberAction, unblockMemberAction, reportMemberAction }))

afterEach(() => {
  blockMemberAction.mockClear()
  unblockMemberAction.mockClear()
  reportMemberAction.mockClear()
})

/**
 * A rede na interface (regras 6.1.2 a 6.1.4, decisão 079). O que se protege: a
 * caixa mostra só nome e cartas, marca o que quem olha procura, e os gestos de
 * bloquear e denunciar pedem confirmação e motivo antes de chegar à ação.
 */

const carta = (variantId: string, cardCode: string, extra: Partial<NetworkMember['preview'][number]> = {}) => ({
  variantId,
  cardCode,
  cardName: `Carta ${cardCode}`,
  rarity: 'SR',
  variantType: 'Normal',
  imageUrl: null,
  quantity: 2,
  wanted: false,
  matching: false,
  ...extra,
})

const ana: NetworkMember = {
  username: 'ana',
  premium: true,
  cards: 12,
  interest: 1,
  preview: [carta('1', 'OP01-001', { wanted: true }), carta('2', 'OP01-002', { variantType: 'Parallel' })],
}

describe('a caixa de uma pessoa', () => {
  it('mostra o nome, o Premium, quantas cartas e quantas quem olha procura', () => {
    render(<NetworkMemberBox member={ana} />)

    const link = screen.getByRole('link', { name: 'Trade Binder de @ana' })
    expect(link).toHaveAttribute('href', '/social/ana')
    expect(within(link).getByText('Premium')).toBeInTheDocument()
    expect(within(link).getByText(/12 cartas para troca/)).toBeInTheDocument()
    expect(within(link).getByText('1 que você procura')).toBeInTheDocument()
  })

  it('a prévia marca o que quem olha procura, e cada carta leva ao binder', () => {
    render(<NetworkMemberBox member={ana} />)
    const previa = within(screen.getByRole('list', { name: 'Prévia das cartas de @ana' }))

    const itens = previa.getAllByRole('listitem')
    expect(itens).toHaveLength(2)
    expect(within(itens[0]).getByText('Você procura')).toBeInTheDocument()
    expect(within(itens[1]).getByText('Parallel')).toBeInTheDocument()
    expect(within(itens[0]).getByRole('link')).toHaveAttribute('href', '/social/ana')
  })

  it('sem interesse, não fala em procura', () => {
    render(<NetworkMemberBox member={{ ...ana, interest: 0, premium: false }} />)
    expect(screen.queryByText(/que você procura/)).not.toBeInTheDocument()
    expect(screen.queryByText('Premium')).not.toBeInTheDocument()
  })
})

describe('bloquear', () => {
  it('pede confirmação, e só então manda o nome para a ação', async () => {
    const user = userEvent.setup()
    render(<BlockToggle username="ana" blocked={false} />)

    await user.click(screen.getByRole('button', { name: 'Bloquear' }))
    expect(screen.getByRole('alertdialog', { name: 'Bloquear @ana?' })).toBeInTheDocument()
    expect(blockMemberAction).not.toHaveBeenCalled()

    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Bloquear' }))
    expect(await screen.findByText('@ana foi bloqueado.')).toBeInTheDocument()
    expect(blockMemberAction.mock.calls[0][1].get('username')).toBe('ana')
  })

  it('bloqueado, oferece desbloquear', async () => {
    const user = userEvent.setup()
    render(<BlockToggle username="ana" blocked />)

    await user.click(screen.getByRole('button', { name: 'Desbloquear @ana' }))
    expect(unblockMemberAction.mock.calls[0][1].get('username')).toBe('ana')
  })
})

describe('denunciar', () => {
  it('exige motivo, e manda nome e motivo para a ação', async () => {
    const user = userEvent.setup()
    render(<ReportForm username="ana" />)

    await user.click(screen.getByRole('button', { name: 'Denunciar' }))
    const enviar = screen.getByRole('button', { name: 'Enviar denúncia' })
    expect(enviar).toBeDisabled()

    await user.type(screen.getByLabelText(/Denunciar @ana/), 'Pediu pagamento adiantado.')
    await user.click(enviar)

    expect(await screen.findByText('Denúncia enviada. Obrigado por avisar.')).toBeInTheDocument()
    const data = reportMemberAction.mock.calls[0][1]
    expect(data.get('username')).toBe('ana')
    expect(data.get('motivo')).toBe('Pediu pagamento adiantado.')
    // Enviada, o botao de denunciar de novo some.
    expect(screen.queryByRole('button', { name: 'Denunciar' })).not.toBeInTheDocument()
  })
})

describe('a lista de bloqueados', () => {
  it('diz quando não há ninguém, e desbloqueia cada um', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<BlockedList blocked={[]} />)
    expect(screen.getByText('Você não bloqueou ninguém.')).toBeInTheDocument()

    rerender(<BlockedList blocked={[{ username: 'ana', since: new Date() }]} />)
    await user.click(screen.getByRole('button', { name: 'Desbloquear' }))
    expect(unblockMemberAction.mock.calls[0][1].get('username')).toBe('ana')
  })
})
