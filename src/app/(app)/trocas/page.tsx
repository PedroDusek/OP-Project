import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/app-shell'
import { OpenTradeCard } from '@/components/trades/open-trade-card'
import { TradeStarter } from '@/components/trades/trade-starter'
import { TradeBinder, TradeBinderSummary } from '@/components/trades/trade-binder'
import { countCopies, getOpenTrade, listTradeBinder } from '@/server/application/trades'
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
  const [aberta, cards] = await Promise.all([getOpenTrade(viewer), listTradeBinder(viewer)])

  return (
    <>
      <PageHeader title="Trocas" />

      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          {aberta ? (
            <OpenTradeCard trade={aberta} appUrl={appUrl()} />
          ) : (
            <TradeStarter appUrl={appUrl()} />
          )}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-text">Trade Binder</h2>
          <TradeBinderSummary cards={cards.length} copies={countCopies(cards)} />
          <TradeBinder cards={cards} />
        </section>
      </div>
    </>
  )
}
