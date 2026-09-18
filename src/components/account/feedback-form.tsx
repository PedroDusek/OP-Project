'use client'

import { useActionState, useState } from 'react'
import { Check } from 'lucide-react'
import { sendFeedbackAction } from '@/app/(app)/conta/actions'
import { FEEDBACK_IDLE } from '@/app/(app)/conta/state'
import { FieldError, FormAlert } from '@/components/auth/form-parts'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/surface'

/**
 * O formulário de feedback (decisão 096).
 *
 * Depois de enviado, o formulário some e fica a confirmação: mandar a mesma
 * mensagem duas vezes por um toque a mais é o erro mais provável aqui.
 */
export function FeedbackForm({ max }: { max: number }) {
  const [state, action, pending] = useActionState(sendFeedbackAction, FEEDBACK_IDLE)
  const [texto, setTexto] = useState('')

  if (state.status === 'sent') {
    return (
      <Panel role="status" className="flex items-start gap-3 p-4">
        <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-text">Recebemos, obrigado!</p>
          <p className="text-sm text-text-muted">
            Sua mensagem foi para o suporte. Se precisarmos de mais detalhes, respondemos no seu e-mail.
          </p>
        </div>
      </Panel>
    )
  }

  const fields = state.status === 'error' ? state.fields : undefined

  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormAlert message={state.status === 'error' && !fields?.mensagem ? state.message : undefined} />

      <label htmlFor="mensagem" className="text-sm font-medium text-text">
        Sua mensagem
      </label>
      <textarea
        id="mensagem"
        name="mensagem"
        rows={7}
        maxLength={max}
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        placeholder="O que funcionou, o que atrapalhou, o que você gostaria de ver no ColeXa…"
        aria-invalid={fields?.mensagem ? true : undefined}
        aria-describedby={fields?.mensagem ? 'mensagem-error' : 'mensagem-contagem'}
        className="rounded-control border border-border bg-surface p-3 text-sm text-text outline-none focus-visible:border-accent-ink"
      />
      <p id="mensagem-contagem" className="text-right text-xs text-text-subtle tabular-nums">
        {texto.length} de {max}
      </p>
      <FieldError id="mensagem-error" messages={fields?.mensagem} />

      <Button type="submit" size="lg" block loading={pending} disabled={texto.trim().length === 0}>
        Enviar feedback
      </Button>
    </form>
  )
}
