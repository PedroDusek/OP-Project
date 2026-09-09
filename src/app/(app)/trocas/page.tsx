import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/app-shell'
import { TradeBinder, TradeBinderSummary } from '@/components/trades/trade-binder'
import { countCopies, listTradeBinder } from '@/server/application/trades'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Trade Binder' }

/**
 * Trade Binder (tela 31).
 *
 * É a soma do que está guardado em locais com finalidade de troca
 * (`business-rules.md` 4.1). Não se monta nada aqui: quem quer mudar o que está
 * disponível mexe nos binders, e a tela leva para lá — dois jeitos de fazer a
 * mesma coisa é como se acaba com duas listas que discordam.
 *
 * O que ainda não existe: **compartilhar** e **matches**. O compartilhamento é
 * a rota pública do Premium (decisão 008), de um checkpoint adiante. Os matches
 * dependem de duas definições que a especificação não dá — o que é
 * "compatibilidade" e quem pode ver o Trade Binder de quem — e inventar
 * qualquer uma seria decidir no lugar do dono do produto.
 */
export default async function TrocasPage() {
  const viewer = await requireViewer('/trocas')
  const cards = await listTradeBinder(viewer)

  return (
    <>
      <PageHeader title="Trade Binder" />
      <div className="flex flex-col gap-4">
        <TradeBinderSummary cards={cards.length} copies={countCopies(cards)} />
        <TradeBinder cards={cards} />
      </div>
    </>
  )
}
