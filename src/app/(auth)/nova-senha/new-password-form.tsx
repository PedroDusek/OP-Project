'use client'

import { useActionState } from 'react'
import { newPasswordAction } from '../actions'
import { IDLE } from '../state'
import { AuthHeading, FieldError, FormAlert, SubmitButton } from '@/components/auth/form-parts'
import { PasswordInput } from '@/components/ui/password-input'

export function NewPasswordForm() {
  const [state, action] = useActionState(newPasswordAction, IDLE)
  const fields = state.status === 'error' ? state.fields : undefined

  return (
    <>
      <AuthHeading title="Criar senha nova" description="Escolha uma senha para voltar à sua conta." />

      <FormAlert message={state.status === 'error' ? state.message : undefined} />

      <form action={action} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="sr-only">
            Nova senha
          </label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            placeholder="Nova senha"
            aria-invalid={fields?.password ? true : undefined}
            aria-describedby={fields?.password ? 'password-error' : 'password-hint'}
            required
          />
          <FieldError id="password-error" messages={fields?.password} />
          {!fields?.password ? (
            <p id="password-hint" className="text-xs text-text-muted">
              Ao menos 8 caracteres.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="passwordConfirmation" className="sr-only">
            Confirmar nova senha
          </label>
          <PasswordInput
            id="passwordConfirmation"
            name="passwordConfirmation"
            autoComplete="new-password"
            placeholder="Confirmar nova senha"
            aria-invalid={fields?.passwordConfirmation ? true : undefined}
            aria-describedby={
              fields?.passwordConfirmation ? 'passwordConfirmation-error' : undefined
            }
            required
          />
          <FieldError id="passwordConfirmation-error" messages={fields?.passwordConfirmation} />
        </div>

        <SubmitButton>Salvar senha</SubmitButton>
      </form>
    </>
  )
}
