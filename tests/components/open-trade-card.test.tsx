import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OpenTradeCard } from '@/components/trades/open-trade-card'
import type { OpenTrade } from '@/server/application/trades'

/*
 * A acao de servidor arrasta o Prisma no grafo de modulos. Sem o duble, o teste
 * tentaria abrir conexao com o banco para renderizar um botao (armadilha 33).
 */
vi.mock('@/app/(app)/trocas/actions', () => ({
  cancelTradeAction: vi.fn(),
}))

/**
 * O cartao da troca aberta.
 *
 * O que se protege aqui e a saida: enquanto ninguem entra, este cartao ocupa o
 * lugar de "comecar uma troca", e sem um jeito de descartar ele ficaria para
 * sempre com um link mandado a quem nunca abriu.
 */

const aberta = (over: Partial<OpenTrade> = {}): OpenTrade => ({
  tradeId: '7',
  status: 'DRAFT',
  otherName: null,
  inviteToken: 'abc123',
  reviewRequested: false,
  exchanged: false,
  ...over,
})

const APP = 'https://colexa.com.br'

describe('o convite que ninguem aceitou', () => {
  it('mostra o link para mandar', () => {
    render(<OpenTradeCard trade={aberta()} appUrl={APP} />)

    expect(screen.getByLabelText('Link do convite')).toHaveValue(
      `${APP}/trocas/entrar/abc123`,
    )
  })

  it('deixa descartar sem precisar abrir a troca', () => {
    render(<OpenTradeCard trade={aberta()} appUrl={APP} />)

    expect(screen.getByRole('button', { name: /descartar este convite/i })).toBeInTheDocument()
  })
})

describe('a troca com alguem do outro lado', () => {
  /*
   * Desfazer sem abrir seria cancelar as costas da outra pessoa. O botao de
   * cancelar existe dentro da negociacao, junto do que se esta cancelando.
   */
  it('nao oferece descartar depois que alguem entrou', () => {
    render(
      <OpenTradeCard
        trade={aberta({ otherName: 'Bruno', inviteToken: null, status: 'NEGOTIATING' })}
        appUrl={APP}
      />,
    )

    expect(
      screen.queryByRole('button', { name: /descartar este convite/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/troca com bruno/i)).toBeInTheDocument()
  })

  it('avisa antes de abrir quando o outro alterou', () => {
    render(
      <OpenTradeCard
        trade={aberta({ otherName: 'Bruno', inviteToken: null, reviewRequested: true })}
        appUrl={APP}
      />,
    )

    expect(screen.getByText(/bruno alterou a troca/i)).toBeInTheDocument()
  })
})
