'use client'

import { useState } from 'react'
import { Check, Copy, Handshake, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/surface'
import type { OpenTrade } from '@/server/application/trades'

/**
 * A troca aberta, no topo de Trocas.
 *
 * Duas situações, e elas pedem coisas diferentes. Com alguém do outro lado, o
 * que importa é entrar na negociação — e, se a pessoa alterou depois de você
 * confirmar, saber disso **antes** de abrir. Sem ninguém ainda, o que importa é
 * o convite: ele é o único jeito de a troca sair do lugar.
 */
export function OpenTradeCard({ trade, appUrl }: { trade: OpenTrade; appUrl: string }) {
  const [copiado, setCopiado] = useState(false)
  const link = trade.inviteToken ? `${appUrl}/trocas/entrar/${trade.inviteToken}` : null

  return (
    <Panel className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink"
        >
          <Handshake className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-text">
            {trade.otherName ? `Troca com ${trade.otherName}` : 'Troca aguardando alguém'}
          </h2>
          <p className="mt-0.5 text-sm text-text-muted">
            {trade.otherName
              ? 'Vocês dois estão dentro. Monte a sua oferta e confirme quando estiver combinado.'
              : 'Mande o convite para quem vai trocar com você.'}
          </p>
        </div>
      </div>

      {trade.reviewRequested ? (
        <p className="flex items-start gap-2 rounded-control bg-warning-soft px-3 py-2 text-sm text-text">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            <strong>{trade.otherName ?? 'A outra pessoa'} alterou a troca.</strong> Revise e
            confirme de novo.
          </span>
        </p>
      ) : null}

      {link ? (
        <div className="flex gap-2">
          <input
            readOnly
            value={link}
            aria-label="Link do convite"
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 rounded-control border border-border bg-surface-muted px-3 py-2 text-sm text-text"
          />
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(link).then(() => setCopiado(true))
            }}
          >
            {copiado ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copiado ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
      ) : null}

      <Button asChild block>
        <a href={`/trocas/${trade.tradeId}`}>Abrir a troca</a>
      </Button>
    </Panel>
  )
}
