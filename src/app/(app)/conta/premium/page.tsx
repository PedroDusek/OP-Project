import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/app-shell'
import { SubscriptionPanel } from '@/components/billing/subscription-panel'
import { readBilling } from '@/server/application/billing'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Premium' }

/**
 * Assinar o Premium, ou gerenciar a assinatura (decisão 102).
 *
 * Aberta a todos os planos: é a tela que o Free precisa alcançar. Quem já é
 * Premium vê até quando vale e o caminho para trocar cartão ou cancelar.
 */
export default async function PremiumPage({ searchParams }: PageProps<'/conta/premium'>) {
  const viewer = await requireViewer('/conta/premium')
  const { pago } = await searchParams
  const billing = await readBilling(viewer)

  return (
    <>
      <PageHeader
        back={{ href: '/conta', label: 'Minha conta' }}
        title="Premium"
        description="O que você vê da sua coleção, e o que dá para fazer nas trocas."
      />
      {/*
        `pago=1` é só a volta da Stripe, e não a prova do pagamento: quem libera
        o acesso é o aviso assinado que chega ao servidor (decisão 102). Por
        isso a tela diz "estamos confirmando", e não "pronto".
      */}
      <SubscriptionPanel billing={billing} voltouDoPagamento={pago === '1'} />
    </>
  )
}
