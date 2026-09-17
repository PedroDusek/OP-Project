import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/app-shell'
import { OpenTradeCard } from '@/components/trades/open-trade-card'
import { ReceivedInvites } from '@/components/trades/received-invites'
import { TradeStarter } from '@/components/trades/trade-starter'
import { TradeBinder, TradeBinderSummary } from '@/components/trades/trade-binder'
import { TradeBinderShareCard } from '@/components/trades/trade-binder-share'
import { PremiumNotice } from '@/components/premium/premium-notice'
import {
  countCopies,
  getOpenTrade,
  getTradeBinderShare,
  listReceivedInvites,
  listTradeBinder,
} from '@/server/application/trades'
import { isPremium } from '@/server/application/authorization'
import { appUrl } from '@/server/http/app-url'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Trocas' }

/**
 * Trocas: a negociação aberta e o Trade Binder (telas 31 e a negociação).
 *
 * A troca vem primeiro porque é o que tem alguém do outro lado esperando. O
 * Trade Binder é consulta, e consulta espera.
 *
 * Uma troca por vez (`business-rules.md` 4.5): ou a tela oferece começar, ou
 * mostra a que está aberta. Oferecer as duas coisas convidaria a um gesto que o
 * servidor recusaria.
 *
 * O Trade Binder continua sendo leitura: quem quer mudar o que está disponível
 * mexe nos binders. Ver `TradeBinder`.
 */
export default async function TrocasPage() {
  const viewer = await requireViewer('/trocas')
  const [aberta, cards, share, convites] = await Promise.all([
    getOpenTrade(viewer),
    listTradeBinder(viewer),
    getTradeBinderShare(viewer),
    listReceivedInvites(viewer),
  ])

  // Decisao 093: comecar troca e publicar o Trade Binder sao Premium. A tela
  // esconde o gesto em vez de deixar o servidor recusar depois do clique.
  const premium = isPremium(viewer)

  return (
    <>
      <PageHeader title="Trocas" />

      <div className="flex flex-col gap-6">
        {/* Primeiro os convites: e alguem esperando uma resposta (decisao 082). */}
        <ReceivedInvites invites={convites} />

        <section className="flex flex-col gap-3">
          {aberta ? (
            <OpenTradeCard trade={aberta} appUrl={appUrl()} />
          ) : premium ? (
            <TradeStarter appUrl={appUrl()} />
          ) : (
            <PremiumNotice
              title="Começar uma troca é Premium"
              description="Você continua entrando em trocas por convite ou por link, e negociando normalmente."
            />
          )}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-text">Trade Binder</h2>
          <TradeBinderSummary cards={cards.length} copies={countCopies(cards)} />
          {/*
            Compartilhar vem antes da lista, como na tela 31: quem rola ate o fim
            das cartas ja encontrou o que procurava, e nao volta para publicar.
          */}
          {premium ? (
            <TradeBinderShareCard share={share} appUrl={appUrl()} cards={cards.length} />
          ) : (
            <PremiumNotice
              title="Publicar o Trade Binder é Premium"
              description="Com o Premium, você gera um link para mostrar suas cartas de troca a quem quiser, sem expor mais nada da coleção."
            />
          )}
          <TradeBinder cards={cards} />
        </section>
      </div>
    </>
  )
}
