import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationBell } from '@/components/layout/notification-bell'

vi.mock('next/navigation', () => ({ usePathname: () => '/inicio' }))

/**
 * O sino (decisão 080). O que se protege: o pontinho aparece enquanto há aviso,
 * o painel diz o que está pendente e leva a onde se resolve, e sem aviso ele diz
 * que não há nada — em vez de levar para Minha conta, como fazia.
 */

const responder = (notices: unknown[]) =>
  vi.fn(async () => new Response(JSON.stringify({ notices }), { status: 200 }))

beforeEach(() => {
  vi.stubGlobal('fetch', responder([]))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('o sino', () => {
  it('com aviso pendente, mostra o pontinho e leva às cartas sem lugar', async () => {
    vi.stubGlobal('fetch', responder([{ kind: 'unallocated-cards', copies: 12, cards: 5 }]))
    const user = userEvent.setup()
    render(<NotificationBell />)

    const sino = await screen.findByRole('button', { name: 'Notificações, 1 pendente' })
    await user.click(sino)

    const aviso = await screen.findByRole('link', { name: /12 cópias sem armazenamento/ })
    expect(aviso).toHaveAttribute('href', '/binders/sem-lugar')
    expect(within(aviso).getByText('5 cartas esperando um binder, caixa ou deck.')).toBeInTheDocument()
  })

  it('sem aviso, não tem pontinho e diz que não há nada pendente', async () => {
    const user = userEvent.setup()
    render(<NotificationBell />)

    await user.click(screen.getByRole('button', { name: 'Notificações' }))
    expect(await screen.findByText('Nada pendente por aqui.')).toBeInTheDocument()
  })

  it('pergunta pelos avisos ao abrir', async () => {
    const fetch = responder([])
    vi.stubGlobal('fetch', fetch)
    render(<NotificationBell />)
    await screen.findByRole('button', { name: 'Notificações' })
    expect(fetch).toHaveBeenCalledWith('/api/me/notificacoes', { cache: 'no-store' })
  })
})
