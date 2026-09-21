'use client'

import { useActionState, useState } from 'react'
import { CreditCard, Gift, QrCode, Sparkles } from 'lucide-react'
import { claimTrialAction, openPortalAction, startCheckoutAction } from '@/app/(app)/conta/premium/actions'
import { CHECKOUT_IDLE } from '@/app/(app)/conta/premium/state'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Panel } from '@/components/ui/surface'
import {
  annualSavingsInCents,
  formatBrl,
  PLANS,
  type BillingCycle,
} from '@/server/domain/billing/plans'
import { TRIAL_DAYS } from '@/server/domain/billing/trial'
import type { BillingView } from '@/server/application/billing'

/**
 * Assinar o Premium, ou ver a assinatura que já existe (decisão 102).
 *
 * ## O que esta tela não faz
 *
 * Ela **não** libera acesso. Os botões levam à Stripe, e quem move o plano é o
 * aviso assinado que chega ao servidor. Por isso a volta do pagamento diz
 * "estamos confirmando": entre pagar e o aviso chegar passam segundos, e
 * prometer o contrário faria a pessoa recarregar achando que deu errado.
 *
 * ## Por que o preço aparece aqui e não só na Stripe
 *
 * Quem decide se vale a pena decide antes de sair do ColeXa. Os números vêm do
 * domínio (`PLANS`), e um teste compara com o que a Stripe cobra.
 */

const O_QUE_TEM = [
  'O dashboard da coleção: valor, playsets e as cartas mais caras',
  'Começar trocas e convidar quem você quiser',
  'Publicar o Trade Binder e aparecer primeiro na rede',
  'Deck Builder, playsets e compartilhar a want list',
]

export function SubscriptionPanel({
  billing,
  voltouDoPagamento,
}: {
  billing: BillingView
  voltouDoPagamento: boolean
}) {
  const [ciclo, setCiclo] = useState<BillingCycle>('ANNUAL')
  const [estado, assinar, enviando] = useActionState(startCheckoutAction, CHECKOUT_IDLE)
  const [estadoPortal, abrirPortal, abrindo] = useActionState(openPortalAction, CHECKOUT_IDLE)
  const [estadoTeste, resgatar, resgatando] = useActionState(claimTrialAction, CHECKOUT_IDLE)

  const plano = PLANS[ciclo]
  const erro =
    estado.status === 'error'
      ? estado.message
      : estadoPortal.status === 'error'
        ? estadoPortal.message
        : estadoTeste.status === 'error'
          ? estadoTeste.message
          : null

  /*
   * Quem já é Premium e não precisa fazer nada não vê plano nenhum (pedido do
   * dono do produto em 20/09): assinar por cima não adianta — o acesso nunca é
   * encurtado, então a pessoa pagaria sem ganhar um dia sequer.
   *
   * Duas exceções, e são as que precisam de ação: o **Pix**, que não renova
   * sozinho, e a assinatura **cancelada ou com cobrança atrasada**, que vai
   * acabar na data. Para elas, o caminho de pagar continua à vista.
   */
  const precisaAgir =
    billing.subscription?.method === 'PIX' ||
    billing.subscription?.status === 'CANCELED' ||
    billing.subscription?.status === 'PAST_DUE' ||
    // Quem está no teste grátis é Premium, mas é justamente para quem os planos
    // existem: esconder deles seria esconder a conversão do teste (decisão 102,
    // mudança de 21/09).
    billing.trial.daysLeft !== null
  const mostrarPlanos = !billing.premium || precisaAgir

  return (
    <div className="flex flex-col gap-4">
      {voltouDoPagamento ? (
        <Panel className="p-4">
          <p className="text-sm text-text">
            Recebemos o seu pagamento e estamos confirmando com a operadora. O Premium entra em
            alguns segundos — atualize esta página.
          </p>
        </Panel>
      ) : null}

      {billing.premium ? (
        <Panel className="flex items-start gap-3 p-4">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-accent-ink" aria-hidden />
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-text">
              {billing.trial.daysLeft === null ? 'Você é Premium' : 'Você está no teste grátis'}
            </h2>
            {billing.premiumUntil ? (
              <p className="text-sm text-text-muted">
                Vale até {billing.premiumUntil.toLocaleDateString('pt-BR')}.
              </p>
            ) : null}
            {/*
              O contador é o aviso do fim, e não há e-mail (decisão 102, mudança
              de 21/09): a pessoa precisa saber que o relógio corre para decidir
              assinar antes de perder o que já montou.
            */}
            {billing.trial.daysLeft !== null ? (
              <p className="text-sm text-text-muted">
                {billing.trial.daysLeft === 1
                  ? 'Acaba amanhã. Assine para não perder o acesso.'
                  : `Faltam ${billing.trial.daysLeft} dias. Assine quando quiser — o teste não vira cobrança.`}
              </p>
            ) : null}
            {billing.subscription?.cancelAtPeriodEnd && billing.subscription.method === 'PIX' ? (
              <p className="text-sm text-text-muted">
                No Pix, cada pagamento compra um período. Para continuar, pague de novo antes do fim.
              </p>
            ) : null}
            {billing.subscription?.status === 'PAST_DUE' ? (
              <p className="text-sm text-danger">
                A última cobrança não passou. Atualize o cartão para não perder o acesso.
              </p>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {billing.subscription ? (
        <form action={abrirPortal}>
          <Button type="submit" variant="secondary" loading={abrindo}>
            Gerenciar pagamento
          </Button>
        </form>
      ) : null}

      {/*
        O teste vem antes dos planos de propósito: é a porta sem atrito, e
        quem chega aqui indeciso decide mais fácil experimentando do que
        comparando preço. Some para sempre depois de resgatado — o carimbo é
        por conta, e a tela não oferece o que vai recusar.
      */}
      {billing.trial.claimable ? (
        <Panel className="flex flex-col gap-3 p-4">
          <div className="flex items-start gap-3">
            <Gift className="mt-0.5 size-5 shrink-0 text-accent-ink" aria-hidden />
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold text-text">
                Experimente {TRIAL_DAYS} dias de Premium
              </h2>
              <p className="text-sm text-text-muted">
                Sem cartão e sem cobrança: acaba sozinho no fim dos {TRIAL_DAYS} dias. Vale uma vez
                por conta.
              </p>
            </div>
          </div>
          <form action={resgatar}>
            <Button type="submit" loading={resgatando}>
              Resgatar {TRIAL_DAYS} dias
            </Button>
          </form>
        </Panel>
      ) : null}

      {!mostrarPlanos ? null : !billing.available ? (
        <Panel className="p-4">
          <p className="text-sm text-text-muted">
            A assinatura ainda não está aberta. Durante o teste, peça o acesso em
            suporte@colexa.com.br.
          </p>
        </Panel>
      ) : (
        <form action={assinar} className="flex flex-col gap-4">
          <Segmented
            label="Ciclo"
            value={ciclo}
            onValueChange={(valor) => setCiclo(valor as BillingCycle)}
            options={[
              { value: 'ANNUAL', label: 'Anual' },
              { value: 'MONTHLY', label: 'Mensal' },
            ]}
          />
          <input type="hidden" name="ciclo" value={ciclo} />

          <Panel className="flex flex-col gap-3 p-4">
            <div>
              <p className="text-2xl font-bold tracking-tight text-text">{plano.label}</p>
              {ciclo === 'ANNUAL' ? (
                <p className="mt-1 text-sm text-text-muted">
                  Sai por {formatBrl(plano.monthlyEquivalentInCents)} por mês. Você economiza{' '}
                  {formatBrl(annualSavingsInCents())} no ano.
                </p>
              ) : null}
            </div>

            <ul className="flex flex-col gap-1.5">
              {O_QUE_TEM.map((item) => (
                <li key={item} className="text-sm text-text-muted">
                  · {item}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" name="forma" value="CARD" loading={enviando}>
                <CreditCard className="size-4" aria-hidden />
                Pagar com cartão
              </Button>
              {/*
                O Pix sai da tela enquanto a Stripe não o libera para a conta
                (armadilha 82). Um botão que leva a erro é pior que botão
                nenhum: a pessoa escolhe, sai do ColeXa e volta sem entender.
              */}
              {billing.pixAvailable ? (
                <Button type="submit" name="forma" value="PIX" variant="secondary" loading={enviando}>
                  <QrCode className="size-4" aria-hidden />
                  Pagar com Pix
                </Button>
              ) : null}
            </div>

            {/*
              Dito antes de a pessoa escolher, e não depois: no Pix a renovação
              é manual (decisão 102), e descobrir isso no vencimento seria
              perder o acesso sem aviso. Sem Pix na tela, não há o que explicar.
            */}
            <p className="text-xs text-text-subtle">
              {billing.pixAvailable
                ? 'No cartão a assinatura renova sozinha, e você cancela quando quiser. No Pix, cada pagamento vale por um período, e avisamos antes de acabar.'
                : 'A assinatura renova sozinha, e você cancela quando quiser.'}
            </p>
          </Panel>
        </form>
      )}

      {erro ? (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      ) : null}
    </div>
  )
}
