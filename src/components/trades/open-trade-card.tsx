'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Handshake, TriangleAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/surface'
import { cancelTradeAction } from '@/app/(app)/trocas/actions'
import { TRADE_ACTION_IDLE } from '@/app/(app)/trocas/state'
import type { OpenTrade } from '@/server/application/trades'

/**
 * A troca aberta, no topo de Trocas.
 *
 * Duas situações, e elas pedem coisas diferentes. Com alguém do outro lado, o
 * que importa é entrar na negociação — e, se a pessoa alterou depois de você
 * confirmar, saber disso **antes** de abrir. Sem ninguém ainda, o que importa é
 * o convite: ele é o único jeito de a troca sair do lugar.
 *
 * ## O convite precisa ter fim
 *
 * Enquanto ninguém entra, este cartão ocupa o lugar de "começar uma troca" — e
 * sem uma saída ele ficaria ali para sempre, com um link que a pessoa mandou
 * para alguém que nunca abriu. Descartar era possível desde sempre pelo servidor,
 * e só não tinha botão: ele morava dentro da negociação, que é onde a pessoa não
 * chega enquanto está sozinha.
 *
 * Descartar queima o link junto com a troca, e é isso que se quer: um convite
 * abandonado é um convite que ainda pode vazar (regra 4.6.1).
 */
/**
 * Enquanto o convite espera, pergunta a cada poucos segundos se a outra pessoa
 * entrou (decisão 084). Relatado pelo dono do produto: aceito o convite, quem
 * convidou continuava vendo "Convite enviado" até sair de Trocas e voltar.
 *
 * Aceito, leva direto para a troca — é o que a pessoa estava esperando. Recusado
 * ou descartado, redesenha Trocas. Pausa com a aba escondida.
 */
function useInviteWait(tradeId: string, esperando: boolean) {
  const router = useRouter()

  useEffect(() => {
    if (!esperando) return
    let cancelado = false

    const perguntar = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const resposta = await fetch(`/api/trocas/${tradeId}/estado`, { cache: 'no-store' })
        if (cancelado || !resposta.ok) return
        const { status } = (await resposta.json()) as { status: string }
        if (status === 'DRAFT') return
        if (status === 'NEGOTIATING' || status === 'PROPOSED' || status === 'CONFIRMED') router.push(`/trocas/${tradeId}`)
        else router.refresh()
      } catch {
        // Rede instavel: a proxima pergunta tenta de novo.
      }
    }

    const timer = setInterval(() => void perguntar(), 3_000)
    return () => {
      cancelado = true
      clearInterval(timer)
    }
  }, [tradeId, esperando, router])
}

export function OpenTradeCard({ trade, appUrl }: { trade: OpenTrade; appUrl: string }) {
  useInviteWait(trade.tradeId, trade.status === 'DRAFT')
  const [copiado, setCopiado] = useState(false)
  const [descartar, descartarAction, descartando] = useActionState(
    cancelTradeAction,
    TRADE_ACTION_IDLE,
  )
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
            {trade.otherName
              ? `Troca com ${trade.otherName}`
              : trade.invitedUsername
                ? `Convite enviado para @${trade.invitedUsername}`
                : 'Troca aguardando alguém'}
          </h2>
          <p className="mt-0.5 text-sm text-text-muted">
            {trade.otherName
              ? 'Vocês dois estão dentro. Monte a sua oferta e confirme quando estiver combinado.'
              : trade.invitedUsername
                ? `A troca abre quando @${trade.invitedUsername} aceitar. Dá para combinar em Conversas enquanto isso.`
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

      {/*
        O convite direto ainda nao aceito nao tem troca para abrir: ninguem dos
        dois ve o cruzamento antes do aceite (decisao 082).
      */}
      {trade.invitedUsername ? null : (
        <Button asChild block>
          <a href={`/trocas/${trade.tradeId}`}>Abrir a troca</a>
        </Button>
      )}

      {/*
        So enquanto ninguem entrou. Depois disso a troca tem outra pessoa do
        outro lado, e desfaze-la sem abrir seria cancelar as costas dela — o
        botao de cancelar existe la dentro, junto do que se esta cancelando.
      */}
      {trade.otherName === null ? (
        <form action={descartarAction}>
          <input type="hidden" name="tradeId" value={trade.tradeId} />
          <Button type="submit" variant="ghost" block loading={descartando}>
            <X className="size-4" aria-hidden />
            Descartar este convite
          </Button>
          {descartar.status === 'error' ? (
            <p role="alert" className="mt-1 text-sm text-danger">
              {descartar.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </Panel>
  )
}
