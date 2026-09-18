import { Crown, Layers, Wallet } from 'lucide-react'
import { CardArt } from '@/components/catalog/card-art'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Panel } from '@/components/ui/surface'
import type { CollectionDashboard } from '@/server/application/collection'

/**
 * O dashboard da coleção (decisão 098).
 *
 * Só apresenta: as contas estão no domínio (`buildDashboard`), e os filtros
 * chegam pela URL, então esta tela é desenhada no servidor, sem buscar nada.
 *
 * Os valores saem em real quando há cotação utilizável, com o dólar ao lado —
 * o preço vem do TCGplayer, em dólar, e esconder isso seria fingir precisão.
 */

function dinheiro(usd: number, rate: number | null) {
  if (rate) return `R$ ${(usd * rate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return `US$ ${usd.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const dolar = (usd: number) =>
  `US$ ${usd.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function CollectionDashboardView({ dashboard }: { dashboard: CollectionDashboard }) {
  const { rate } = dashboard
  const maiorFatia = (fatias: { valueUsd: number }[]) => Math.max(1, ...fatias.map((f) => f.valueUsd))

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Panel className="flex flex-col gap-1 p-4">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted">
            <Wallet className="size-4" aria-hidden /> Valor da coleção
          </p>
          <p className="text-2xl font-bold text-text tabular-nums">{dinheiro(dashboard.totalValueUsd, rate)}</p>
          <p className="text-xs text-text-muted tabular-nums">
            {dashboard.totalCopies.toLocaleString('pt-BR')} cópias
            {rate ? ` · ${dolar(dashboard.totalValueUsd)}` : ''}
            {dashboard.copiesWithoutPrice > 0 ? ` · ${dashboard.copiesWithoutPrice} sem preço conhecido` : ''}
          </p>
        </Panel>
        <Panel className="flex flex-col gap-1 p-4">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted">
            <Layers className="size-4" aria-hidden /> Para completar este recorte
          </p>
          <p className="text-2xl font-bold text-text tabular-nums">{dinheiro(dashboard.completeUsd, rate)}</p>
          <p className="text-xs text-text-muted">Uma cópia de cada variante que falta, pelo preço de hoje.</p>
        </Panel>
      </div>

      {dashboard.mostValuable.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-text">
            <Crown className="size-4" aria-hidden /> As mais valiosas
          </h2>
          <ul className="flex flex-col gap-2">
            {dashboard.mostValuable.map((carta, i) => (
              <li key={carta.variantId}>
                <Panel className="flex items-center gap-3 p-2.5">
                  <span className="w-5 text-center text-sm font-bold text-text-subtle tabular-nums">{i + 1}</span>
                  <span className="w-10 shrink-0">
                    <CardArt src={carta.imageUrl} alt={carta.cardName} fallback={carta.cardCode} sizes="40px" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{carta.cardName}</p>
                    <p className="text-xs text-text-muted tabular-nums">
                      {carta.cardCode}
                      {carta.variantType !== 'Normal' ? ` · ${carta.variantType}` : ''}
                      {carta.quantity > 1 ? ` · x${carta.quantity}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-text tabular-nums">{dinheiro(carta.unitUsd, rate)}</span>
                </Panel>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-text">Por coleção</h2>
        {dashboard.bySet.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhuma coleção neste recorte.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {dashboard.bySet.map((progresso) => (
              <li key={progresso.set.id}>
                <Panel className="flex gap-3 p-3">
                  <span className="w-16 shrink-0 sm:w-20">
                    <CardArt
                      src={progresso.set.coverUrl}
                      alt={progresso.set.displayName}
                      fallback={progresso.set.displayCode}
                      sizes="80px"
                    />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text">{progresso.set.displayCode}</p>
                      <p className="truncate text-xs text-text-muted">{progresso.set.displayName}</p>
                    </div>
                    <Barra rotulo="variantes" valor={progresso.variantsOwned} total={progresso.variantsTotal} />
                    <Barra rotulo="playsets" valor={progresso.playsetsClosed} total={progresso.playsetsTotal} />
                    <p className="text-xs text-text-muted tabular-nums">
                      Vale {dinheiro(progresso.valueUsd, rate)} · completar: {dinheiro(progresso.completeUsd, rate)}
                      {progresso.missingWithoutPrice > 0 ? ` (+${progresso.missingWithoutPrice} sem preço)` : ''}
                    </p>
                  </div>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(
        [
          ['Por raridade', dashboard.byRarity],
          ['Por cor', dashboard.byColor],
          ['Por tipo', dashboard.byType],
        ] as const
      ).map(([titulo, fatias]) =>
        fatias.length > 0 ? (
          <section key={titulo} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-text">{titulo}</h2>
            <Panel className="flex flex-col gap-2.5 p-4">
              {fatias.map((fatia) => (
                <div key={fatia.label} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-text">{fatia.label}</span>
                    <span className="text-xs text-text-muted tabular-nums">
                      {fatia.copies} {fatia.copies === 1 ? 'cópia' : 'cópias'} · {dinheiro(fatia.valueUsd, rate)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(2, (fatia.valueUsd / maiorFatia(fatias)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {titulo === 'Por cor' ? (
                <p className="text-xs text-text-subtle">Carta de duas cores aparece nas duas.</p>
              ) : null}
            </Panel>
          </section>
        ) : null,
      )}
    </div>
  )
}

/** "10/150 variantes", como no desenho do dono do produto, com a barra embaixo. */
function Barra({ rotulo, valor, total }: { rotulo: string; valor: number; total: number }) {
  const percentual = total === 0 ? 0 : Math.round((valor / total) * 100)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-xs tabular-nums">
        <span className="font-medium text-text">
          {valor}/{total} {rotulo}
        </span>
        <span className="text-text-muted">{percentual}%</span>
      </div>
      <ProgressBar label={`${valor} de ${total} ${rotulo}`} value={valor} total={total} />
    </div>
  )
}
