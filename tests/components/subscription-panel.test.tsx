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
  claimTrialAction: vi.fn(async () => ({ status: 'idle' })),
}))

/** Quem já resgatou, ou já é Premium por outro motivo: sem oferta e sem contador. */
const SEM_TESTE = { claimable: false, daysLeft: null }

const base: BillingView = {
  premium: false,
  premiumUntil: null,
  subscription: null,
  available: true,
  pixAvailable: true,
  trial: SEM_TESTE,
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
   * Em 21/09 a Stripe libera Pix por convite, e a conta do ColeXa não tem.
   * Um botão que leva a erro é pior que botão nenhum (armadilha 82), e a frase
   * que explica o Pix sai junto — senão prometeria uma forma que não existe.
   */
  it('esconde o Pix, e o que ele explica, quando o provedor não tem Pix', () => {
    render(<SubscriptionPanel billing={{ ...base, pixAvailable: false }} voltouDoPagamento={false} />)

    expect(screen.getByRole('button', { name: /cartão/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pix/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/cada pagamento vale por um período/i)).not.toBeInTheDocument()
    expect(screen.getByText(/renova sozinha/i)).toBeInTheDocument()
  })

  /* A porta sem atrito: aparece antes dos planos, e diz o limite antes do clique. */
  it('oferece o teste grátis a quem nunca resgatou', () => {
    render(
      <SubscriptionPanel
        billing={{ ...base, trial: { claimable: true, daysLeft: null } }}
        voltouDoPagamento={false}
      />,
    )

    expect(screen.getByRole('button', { name: /resgatar 7 dias/i })).toBeInTheDocument()
    expect(screen.getByText(/sem cartão e sem cobrança/i)).toBeInTheDocument()
    expect(screen.getByText(/uma vez por conta/i)).toBeInTheDocument()
  })

  it('não oferece o teste a quem já resgatou', () => {
    render(<SubscriptionPanel billing={base} voltouDoPagamento={false} />)

    expect(screen.queryByRole('button', { name: /resgatar/i })).not.toBeInTheDocument()
  })

  /*
   * Quem está no teste **é** Premium, mas é para ele que os planos existem:
   * esconder seria esconder a conversão. O contador é o único aviso do fim —
   * não há e-mail (decisão 102, mudança de 21/09).
   */
  it('durante o teste, mostra o que falta e mantém os planos à vista', () => {
    render(
      <SubscriptionPanel
        billing={{
          ...base,
          premium: true,
          premiumUntil: new Date('2026-09-28T12:00:00Z'),
          trial: { claimable: false, daysLeft: 5 },
        }}
        voltouDoPagamento={false}
      />,
    )

    expect(screen.getByText(/você está no teste grátis/i)).toBeInTheDocument()
    expect(screen.getByText(/faltam 5 dias/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cartão/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /resgatar/i })).not.toBeInTheDocument()
  })

  /* "Falta 1 dia" soa como sobra; "acaba amanhã" é o que faz decidir. */
  it('no último dia, diz que acaba amanhã', () => {
    render(
      <SubscriptionPanel
        billing={{
          ...base,
          premium: true,
          premiumUntil: new Date('2026-09-22T12:00:00Z'),
          trial: { claimable: false, daysLeft: 1 },
        }}
        voltouDoPagamento={false}
      />,
    )

    expect(screen.getByText(/acaba amanhã/i)).toBeInTheDocument()
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
          pixAvailable: true,
          trial: SEM_TESTE,
        }}
        voltouDoPagamento={false}
      />,
    )

    expect(screen.getByText(/você é premium/i)).toBeInTheDocument()
    expect(screen.getByText(/15\/11\/2026/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /gerenciar pagamento/i })).toBeInTheDocument()
  })

  /*
   * Quem tem cortesia não vê botão de gerenciar — não há o que gerenciar — nem
   * os planos: assinar por cima cobraria sem dar um dia a mais, porque o acesso
   * nunca é encurtado (pedido do dono do produto em 20/09).
   */
  it('cortesia não oferece gerenciar nem assinar', () => {
    render(
      <SubscriptionPanel
        billing={{ ...base, premium: true, premiumUntil: new Date('2046-09-19T00:00:00Z') }}
        voltouDoPagamento={false}
      />,
    )

    expect(screen.queryByRole('button', { name: /gerenciar pagamento/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cartão/i })).not.toBeInTheDocument()
  })

  it('assinatura no cartão em dia não mostra os planos de novo', () => {
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
          pixAvailable: true,
          trial: SEM_TESTE,
        }}
        voltouDoPagamento={false}
      />,
    )

    expect(screen.queryByRole('button', { name: /pix/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /gerenciar pagamento/i })).toBeInTheDocument()
  })

  /* O Pix não renova sozinho: esconder o caminho de pagar faria a pessoa
     perder o acesso sem ter como evitar. */
  it('quem pagou no Pix continua vendo como pagar de novo', () => {
    render(
      <SubscriptionPanel
        billing={{
          premium: true,
          premiumUntil: new Date('2026-11-15T12:00:00Z'),
          subscription: {
            status: 'ACTIVE',
            cycle: 'MONTHLY',
            method: 'PIX',
            currentPeriodEnd: new Date('2026-11-15T12:00:00Z'),
            cancelAtPeriodEnd: true,
          },
          available: true,
          pixAvailable: true,
          trial: SEM_TESTE,
        }}
        voltouDoPagamento={false}
      />,
    )

    expect(screen.getByRole('button', { name: /pix/i })).toBeInTheDocument()
  })

  /* Cancelada ainda vale até a data, e vai acabar: o caminho de voltar fica. */
  it('assinatura cancelada continua oferecendo assinar', () => {
    render(
      <SubscriptionPanel
        billing={{
          premium: true,
          premiumUntil: new Date('2026-11-15T12:00:00Z'),
          subscription: {
            status: 'CANCELED',
            cycle: 'ANNUAL',
            method: 'CARD',
            currentPeriodEnd: new Date('2026-11-15T12:00:00Z'),
            cancelAtPeriodEnd: true,
          },
          available: true,
          pixAvailable: true,
          trial: SEM_TESTE,
        }}
        voltouDoPagamento={false}
      />,
    )

    expect(screen.getByRole('button', { name: /cartão/i })).toBeInTheDocument()
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
          pixAvailable: true,
          trial: SEM_TESTE,
        }}
        voltouDoPagamento={false}
      />,
    )

    expect(screen.getByText(/última cobrança não passou/i)).toBeInTheDocument()
  })
})
