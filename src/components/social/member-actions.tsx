'use client'

import { startTransition, useActionState, useState } from 'react'
import { Ban, Flag } from 'lucide-react'
import { blockMemberAction, reportMemberAction, unblockMemberAction } from '@/app/(app)/social/actions'
import { NETWORK_ACTION_IDLE, type NetworkActionState } from '@/app/(app)/social/state'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Field, Textarea } from '@/components/ui/field'
import { Panel } from '@/components/ui/surface'
import { REPORT_REASON_MAX } from '@/server/domain/social/network'

/**
 * Bloquear e denunciar alguém da rede (regra 6.1.4).
 *
 * Bloquear pede confirmação e diz o que acontece: a pessoa some da rede para quem
 * bloqueou. Denunciar abre um campo de motivo, que é obrigatório — quem lê a
 * denúncia precisa saber o que aconteceu.
 */

function Aviso({ state }: { state: NetworkActionState }) {
  if (state.status === 'idle') return null
  return (
    <p
      aria-live="polite"
      role={state.status === 'error' ? 'alert' : undefined}
      className={state.status === 'error' ? 'text-sm text-danger' : 'text-sm text-success'}
    >
      {state.message}
    </p>
  )
}

export function BlockToggle({ username, blocked }: { username: string; blocked: boolean }) {
  const [bloquearState, bloquear, bloqueando] = useActionState(blockMemberAction, NETWORK_ACTION_IDLE)
  const [desbloquearState, desbloquear, desbloqueando] = useActionState(unblockMemberAction, NETWORK_ACTION_IDLE)
  const [confirmando, setConfirmando] = useState(false)

  const dados = () => {
    const data = new FormData()
    data.set('username', username)
    return data
  }

  if (blocked) {
    return (
      <div className="flex flex-col gap-2">
        <form action={desbloquear}>
          <input type="hidden" name="username" value={username} />
          <Button type="submit" variant="secondary" size="sm" loading={desbloqueando}>
            Desbloquear @{username}
          </Button>
        </form>
        <Aviso state={desbloquearState} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmando(true)}>
        <Ban className="size-4" aria-hidden />
        Bloquear
      </Button>
      <ConfirmDialog
        open={confirmando}
        onOpenChange={setConfirmando}
        title={`Bloquear @${username}?`}
        description={`@${username} deixa de aparecer para você na rede. Dá para desbloquear depois, em Minha conta.`}
        confirmLabel="Bloquear"
        loading={bloqueando}
        onConfirm={() => {
          setConfirmando(false)
          startTransition(() => bloquear(dados()))
        }}
      />
      <Aviso state={bloquearState} />
    </div>
  )
}

export function ReportForm({ username }: { username: string }) {
  const [state, denunciar, enviando] = useActionState(reportMemberAction, NETWORK_ACTION_IDLE)
  const [aberto, setAberto] = useState(false)
  const [motivo, setMotivo] = useState('')
  // Enviada, a denuncia nao se repete daqui: o aviso de enviada fica no lugar.
  const enviada = state.status === 'done'

  if (!aberto || enviada) {
    return (
      <div className="flex flex-col gap-2">
        {enviada ? null : (
          <Button type="button" variant="ghost" size="sm" onClick={() => setAberto(true)}>
            <Flag className="size-4" aria-hidden />
            Denunciar
          </Button>
        )}
        <Aviso state={state} />
      </div>
    )
  }

  return (
    <Panel className="flex flex-col gap-3 p-4">
      <form action={denunciar} className="flex flex-col gap-3">
        <input type="hidden" name="username" value={username} />
        <Field
          label={`Denunciar @${username}`}
          hint={`Conte o que aconteceu. A denúncia vai para a equipe do ColeXa, e @${username} não fica sabendo quem denunciou.`}
          error={state.status === 'error' ? state.message : undefined}
          required
        >
          {(props) => (
            <Textarea
              {...props}
              name="motivo"
              rows={4}
              maxLength={REPORT_REASON_MAX}
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
            />
          )}
        </Field>
        <div className="flex gap-2">
          <Button type="submit" variant="danger" size="sm" loading={enviando} disabled={motivo.trim() === ''}>
            Enviar denúncia
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
        </div>
      </form>
    </Panel>
  )
}
