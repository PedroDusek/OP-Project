'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { passwordResetAction } from '../actions'
import { IDLE } from '../state'
import {
  AuthHeading,
  FieldError,
  FormAlert,
  SentToEmail,
  SubmitButton,
} from '@/components/auth/form-parts'
import { Input } from '@/components/ui/field'

export function PasswordResetForm() {
  const [state, action] = useActionState(passwordResetAction, IDLE)

  if (state.status === 'sent') {
    return (
      <>
        <SentToEmail
          state={state}
          title="Confira seu e-mail"
          description="Se houver uma conta com esse endereço, enviamos um link para criar uma senha nova."
        />
        <p className="mt-4 text-center text-sm text-text-muted">
          <Link href="/entrar" className="font-medium text-accent-ink underline underline-offset-2">
            Voltar para entrar
          </Link>
        </p>
      </>
    )
  }

  const fields = state.status === 'error' ? state.fields : undefined

  return (
    <>
      <AuthHeading
        title="Esqueceu a senha?"
        description="Informe seu e-mail e enviamos um link para você criar uma nova."
      />

      <FormAlert message={state.status === 'error' ? state.message : undefined} />

      <form action={action} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="sr-only">
            E-mail
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="E-mail"
            icon={<Mail className="size-4" />}
            aria-invalid={fields?.email ? true : undefined}
            aria-describedby={fields?.email ? 'email-error' : undefined}
            required
          />
          <FieldError id="email-error" messages={fields?.email} />
        </div>

        <SubmitButton>Enviar link</SubmitButton>
      </form>

      <p className="mt-8 text-center text-sm text-text-muted">
        Lembrou?{' '}
        <Link href="/entrar" className="font-medium text-accent-ink underline underline-offset-2">
          Entrar
        </Link>
      </p>
    </>
  )
}
