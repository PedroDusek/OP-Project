'use client'

import { useActionState } from 'react'
import { unblockMemberAction } from '@/app/(app)/social/actions'
import { NETWORK_ACTION_IDLE } from '@/app/(app)/social/state'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/surface'
import type { BlockedMember } from '@/server/application/social'

/**
 * A lista de bloqueados, nas configurações da conta, com desbloquear ao lado de
 * cada nome (regra 6.1.4).
 */
export function BlockedList({ blocked }: { blocked: BlockedMember[] }) {
  return (
    <Panel className="flex flex-col gap-3 p-4">
      <div>
        <h3 className="text-sm font-semibold text-text">Pessoas bloqueadas</h3>
        <p className="mt-1 text-sm text-text-muted">
          Quem você bloqueia não aparece para você na rede.
        </p>
      </div>
      {blocked.length === 0 ? (
        <p className="text-sm text-text-muted">Você não bloqueou ninguém.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {blocked.map((pessoa) => (
            <li key={pessoa.username}>
              <Desbloquear username={pessoa.username} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function Desbloquear({ username }: { username: string }) {
  const [state, desbloquear, pendente] = useActionState(unblockMemberAction, NETWORK_ACTION_IDLE)
  return (
    <form action={desbloquear} className="flex items-center gap-3 py-2">
      <input type="hidden" name="username" value={username} />
      <span className="min-w-0 flex-1 truncate text-sm text-text">@{username}</span>
      {state.status === 'error' ? (
        <span role="alert" className="text-sm text-danger">
          {state.message}
        </span>
      ) : null}
      <Button type="submit" variant="secondary" size="sm" loading={pendente}>
        Desbloquear
      </Button>
    </form>
  )
}
