import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TradeBinderShareCard } from '@/components/trades/trade-binder-share'

/*
 * As acoes de servidor arrastam o Prisma no grafo de modulos (armadilha 33).
 */
vi.mock('@/app/(app)/trocas/actions', () => ({
  publishTradeBinderAction: vi.fn(),
  revokeTradeBinderAction: vi.fn(),
}))

/**
 * Publicar o Trade Binder, na tela.
 *
 * O que se protege aqui e o **consentimento informado**: publicar expoe dado
 * para quem tiver o endereco, e a pessoa precisa saber exatamente o que sai
 * antes do gesto. Uma tela que so diz "compartilhar" faz alguem publicar sem
 * saber o que publicou.
 */

const APP = 'https://colexa.com.br'

describe('antes de publicar', () => {
  it('diz o que a pagina mostra e o que ela nao mostra', () => {
    render(
      <TradeBinderShareCard share={{ token: null, publishedAt: null }} appUrl={APP} cards={12} />,
    )

    expect(screen.getByText(/seu nome de usuário/i)).toBeInTheDocument()
    expect(screen.getByText(/não mostra sua coleção/i)).toBeInTheDocument()
    expect(screen.getByText(/nem seu nome real ou e-mail/i)).toBeInTheDocument()
  })

  it('oferece publicar, e nao mostra link nenhum', () => {
    render(
      <TradeBinderShareCard share={{ token: null, publishedAt: null }} appUrl={APP} cards={12} />,
    )

    expect(screen.getByRole('button', { name: /publicar e gerar o link/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('Link do Trade Binder')).not.toBeInTheDocument()
  })

  /* Publicar um binder vazio funciona, mas quem abrir nao ve nada. */
  it('avisa quando nao ha carta nenhuma para mostrar', () => {
    render(
      <TradeBinderShareCard share={{ token: null, publishedAt: null }} appUrl={APP} cards={0} />,
    )

    expect(screen.getByText(/seu trade binder está vazio/i)).toBeInTheDocument()
  })

  it('nao avisa de vazio quando ha cartas', () => {
    render(
      <TradeBinderShareCard share={{ token: null, publishedAt: null }} appUrl={APP} cards={3} />,
    )

    expect(screen.queryByText(/está vazio/i)).not.toBeInTheDocument()
  })
})

describe('depois de publicar', () => {
  const publicado = { token: 'abc123', publishedAt: new Date('2026-09-10') }

  it('mostra o link montado', () => {
    render(<TradeBinderShareCard share={publicado} appUrl={APP} cards={12} />)

    expect(screen.getByLabelText('Link do Trade Binder')).toHaveValue(`${APP}/trade/abc123`)
  })

  /* Revogar fica ao lado do link, nao num menu: quem mandou errado tem pressa. */
  it('oferece revogar e regerar junto do link', () => {
    render(<TradeBinderShareCard share={publicado} appUrl={APP} cards={12} />)

    expect(screen.getByRole('button', { name: /parar de compartilhar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /gerar um link novo/i })).toBeInTheDocument()
    expect(screen.getByText(/derruba o anterior/i)).toBeInTheDocument()
  })

  it('nao repete a explicacao do que sai', () => {
    render(<TradeBinderShareCard share={publicado} appUrl={APP} cards={12} />)

    // Ja publicado, a lista do que sai vira ruido: a decisao ja foi tomada.
    expect(screen.queryByText(/não mostra sua coleção/i)).not.toBeInTheDocument()
  })
})
