'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Handshake } from 'lucide-react'
import { acceptInviteAction, declineInviteAction } from '@/app/(app)/trocas/actions'
import { TRADE_ACTION_IDLE } from '@/app/(app)/trocas/state'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/surface'
import type { ReceivedInvite } from '@/server/application/trades'

/**
 * Os convites diretos recebidos (decisão 082): aceitar abre a negociação, recusar
 * cancela.
 *
 * Aceitar é o consentimento da regra 4.6.1 — só a partir daí os dois veem o
 * cruzamento. Por isso a tela diz isso antes do botão.
 */
export function ReceivedInvites({ invites }: { invites: ReceivedInvite[] }) {
  if (invites.length === 0) return null

  return (
    <section className="flex flex-col gap-3" aria-label="Convites de troca recebidos">
      <h2 className="text-sm font-semibold text-text">Convites recebidos</h2>
      <ul className="flex flex-col gap-3">
        {invites.map((convite) => (
          <li key={convite.tradeId}>
            <Convite convite={convite} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function Convite({ convite }: { convite: ReceivedInvite }) {
  const [aceitar, aceitarAction, aceitando] = useActionState(acceptInviteAction, TRADE_ACTION_IDLE)
  const [recusar, recusarAction, recusando] = useActionState(declineInviteAction, TRADE_ACTION_IDLE)
  const quem = convite.fromUsername ? `@${convite.fromUsername}` : 'Alguém'
  const erro = aceitar.status === 'error' ? aceitar.message : recusar.status === 'error' ? recusar.message : null

  return (
    <Panel className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
          <Handshake className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text">
            {convite.fromUsername ? (
              <Link href={`/social/${convite.fromUsername}`} className="hover:underline">
                {quem}
              </Link>
            ) : (
              quem
            )}{' '}
            convidou você para uma troca
          </p>
          <p className="mt-0.5 text-sm text-text-muted">
            Ao aceitar, vocês dois passam a ver o que um tem que o outro procura, e montam as ofertas.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <form action={aceitarAction} className="flex-1">
          <input type="hidden" name="tradeId" value={convite.tradeId} />
          <Button type="submit" block loading={aceitando}>
            Aceitar
          </Button>
        </form>
        <form action={recusarAction} className="flex-1">
          <input type="hidden" name="tradeId" value={convite.tradeId} />
          <Button type="submit" variant="secondary" block loading={recusando}>
            Recusar
          </Button>
        </form>
      </div>
      {erro ? (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      ) : null}
    </Panel>
  )
}
