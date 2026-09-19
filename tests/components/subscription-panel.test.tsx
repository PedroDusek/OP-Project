import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SubscriptionPanel } from '@/components/billing/subscription-panel'
import { PLANS } from '@/server/domain/billing/plans'
import type { BillingView } from '@/server/application/billing/subscribe'

/**
 * A tela de assinar (decisão 102).
 *
 * O que se protege: o preço que aparece é o do domínio — o mesmo que a Stripe
 * cobra —, a volta do pagamento não promete acesso que ainda não chegou, e a
 * renovação manual do Pix é dita antes da escolha, e não no vencimento.
 */

vi.mock('@/app/(app)/conta/premium/actions', () => ({
  startCheckoutAction: vi.fn(async () => ({ status: 'idle' })),
  openPortalAction: vi.fn(async () => ({ status: 'idle' })),
}))

const base: BillingView = {
  premium: false,
  premiumUntil: null,
  subscription: null,
  available: true,
}

describe('SubscriptionPanel', () => {
  it('mostra o preço do domínio, e o que o anual economiza', () => {
    render(<SubscriptionPanel billing={base} voltouDoPagamento={false} />)

    expect(screen.getByText(PLANS.ANNUAL.label)).toBeInTheDocument()
    expect(screen.getByText(/economiza/i)).toHaveTextContent('R$')
  })

  it('oferece cartão e Pix, e avisa que o Pix não renova sozinho', () => {
    render(<SubscriptionPanel billing={base} voltouDoPagamento={false} />)

    expect(screen.getByRole('button', { name: /cartão/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pix/i })).toBeInTheDocument()
    expect(screen.getByText(/cada pagamento vale por um período/i)).toBeInTheDocument()
  })

  /*
   * A volta da Stripe não é prova de pagamento: quem libera é o aviso assinado.
   * Prometer "pronto" aqui faria a pessoa achar que quebrou quando a tela ainda
   * mostrasse o plano antigo.
   */
  it('na volta do pagamento, diz que está confirmando', () => {
    render(<SubscriptionPanel billing={base} voltouDoPagamento />)

    expect(screen.getByText(/estamos confirmando/i)).toBeInTheDocument()
  })

  it('quem é Premium vê até quando vale, e o caminho para gerenciar', () => {
    render(
      <SubscriptionPanel
        billing={{
          premium: true,
          premiumUntil: new Date('2026-11-15T12:00:00Z'),
          subscription: {
            status: 'ACTIVE',
            cycle: 'MONTHLY',
            method: 'CARD',
            currentPeriodEnd: new Date('2026-11-15T12:00:00Z'),
            cancelAtPeriodEnd: false,
          },
          available: true,
        }}
        voltouDoPagamento={false}
      />,
    )

    expect(screen.getByText(/você é premium/i)).toBeInTheDocument()
    expect(screen.getByText(/15\/11\/2026/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /gerenciar pagamento/i })).toBeInTheDocument()
  })

  /* Quem tem cortesia não vê botão de gerenciar: não há o que gerenciar. */
  it('cortesia não oferece gerenciar pagamento', () => {
    render(
      <SubscriptionPanel
        billing={{ ...base, premium: true, premiumUntil: new Date('2046-09-19T00:00:00Z') }}
        voltouDoPagamento={false}
      />,
    )

    expect(screen.queryByRole('button', { name: /gerenciar pagamento/i })).not.toBeInTheDocument()
  })

  /* Sem chaves configuradas, nenhum botão que não leva a lugar nenhum. */
  it('sem provedor configurado, não oferece pagamento', () => {
    render(<SubscriptionPanel billing={{ ...base, available: false }} voltouDoPagamento={false} />)

    expect(screen.queryByRole('button', { name: /cartão/i })).not.toBeInTheDocument()
    expect(screen.getByText(/ainda não está aberta/i)).toBeInTheDocument()
  })

  it('avisa quando a cobrança falhou', () => {
    render(
      <SubscriptionPanel
        billing={{
          premium: true,
          premiumUntil: new Date('2026-11-15T12:00:00Z'),
          subscription: {
            status: 'PAST_DUE',
            cycle: 'MONTHLY',
            method: 'CARD',
            currentPeriodEnd: new Date('2026-11-15T12:00:00Z'),
            cancelAtPeriodEnd: false,
          },
          available: true,
        }}
        voltouDoPagamento={false}
      />,
    )

    expect(screen.getByText(/última cobrança não passou/i)).toBeInTheDocument()
  })
})
