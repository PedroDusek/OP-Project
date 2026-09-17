'use client'

import { useActionState } from 'react'
import { MessageCircle } from 'lucide-react'
import { startConversationAction } from '@/app/(app)/conversas/actions'
import { START_CONVERSATION_IDLE } from '@/app/(app)/conversas/state'
import { Button } from '@/components/ui/button'

/**
 * "Mandar mensagem", no Trade Binder de alguém da rede (decisão 081). Abre a
 * conversa — ou a que já existe — e leva para ela.
 */
export function StartConversationButton({ username }: { username: string }) {
  const [state, abrir, abrindo] = useActionState(startConversationAction, START_CONVERSATION_IDLE)

  return (
    <form action={abrir} className="flex flex-col gap-2">
      <input type="hidden" name="username" value={username} />
      <Button type="submit" size="sm" loading={abrindo}>
        <MessageCircle className="size-4" aria-hidden />
        Mandar mensagem
      </Button>
      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
