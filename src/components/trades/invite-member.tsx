'use client'

import { useActionState } from 'react'
import { Handshake } from 'lucide-react'
import { inviteMemberAction } from '@/app/(app)/trocas/actions'
import { TRADE_ACTION_IDLE } from '@/app/(app)/trocas/state'
import { Button } from '@/components/ui/button'

/**
 * "Convidar para trocar", no Trade Binder de alguém da rede (decisão 082).
 * O convite vai para Trocas da outra pessoa, que aceita ou recusa.
 */
export function InviteMemberButton({ username }: { username: string }) {
  const [state, convidar, convidando] = useActionState(inviteMemberAction, TRADE_ACTION_IDLE)

  return (
    <form action={convidar} className="flex flex-col gap-2">
      <input type="hidden" name="username" value={username} />
      <Button type="submit" size="sm" variant="secondary" loading={convidando}>
        <Handshake className="size-4" aria-hidden />
        Convidar para trocar
      </Button>
      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
