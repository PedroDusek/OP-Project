'use client'

import { useActionState, useState } from 'react'
import { requestAccountDeletionAction } from '@/app/(app)/conta/actions'
import { DELETION_IDLE } from '@/app/(app)/conta/state'
import { FieldError, FormAlert } from '@/components/auth/form-parts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'

/**
 * Confirmar a exclusão da conta (decisão 091).
 *
 * Digitar a palavra, e não a senha: quem entra com Google não tem senha. O botão
 * só acende com a palavra digitada, e o servidor confere de novo — o botão
 * apagado é conveniência, não garantia.
 */
export function DeleteAccountForm({ confirmation }: { confirmation: string }) {
  const [state, action, pending] = useActionState(requestAccountDeletionAction, DELETION_IDLE)
  const [typed, setTyped] = useState('')

  const fields = state.status === 'error' ? state.fields : undefined
  const pronto = typed.trim().toUpperCase() === confirmation

  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormAlert message={state.status === 'error' && !fields?.confirmacao ? state.message : undefined} />

      <label htmlFor="confirmacao" className="text-sm font-medium text-text">
        Para confirmar, digite {confirmation}
      </label>
      <Input
        id="confirmacao"
        name="confirmacao"
        autoComplete="off"
        autoCapitalize="characters"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        aria-invalid={fields?.confirmacao ? true : undefined}
        aria-describedby={fields?.confirmacao ? 'confirmacao-error' : undefined}
      />
      <FieldError id="confirmacao-error" messages={fields?.confirmacao} />

      <Button type="submit" variant="danger" size="lg" block disabled={!pronto} loading={pending}>
        Pedir a exclusão da conta
      </Button>
    </form>
  )
}
