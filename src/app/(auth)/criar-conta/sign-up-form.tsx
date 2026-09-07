'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Mail, User } from 'lucide-react'
import { signUpAction } from '../actions'
import { IDLE } from '../state'
import {
  AuthHeading,
  FieldError,
  FormAlert,
  SentToEmail,
  SubmitButton,
} from '@/components/auth/form-parts'
import { SocialButtons } from '@/components/auth/social-buttons'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'
import type { OAuthProviderId } from '@/server/http/auth-provider'

/**
 * Criar conta.
 *
 * Os campos são controlados pelo mesmo motivo do formulário de entrar: o React
 * reseta o `<form action={...}>` quando a ação termina, inclusive em erro, e um
 * cadastro de cinco campos que se apaga por uma senha curta é o caminho para a
 * pessoa desistir.
 */
export function SignUpForm({ providers }: { providers: OAuthProviderId[] }) {
  const [state, action] = useActionState(signUpAction, IDLE)
  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirmation: '',
  })
  const bind = (field: keyof typeof values) => ({
    value: values[field],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((current) => ({ ...current, [field]: event.target.value })),
  })

  /*
   * Com confirmação por e-mail ligada, o cadastro termina aqui e não dentro do
   * app: a conta existe, mas a sessão só nasce depois do clique no link. Mostrar
   * o formulário de novo faria a pessoa tentar cadastrar duas vezes.
   */
  if (state.status === 'sent') {
    return (
      <>
        <SentToEmail
          state={state}
          title="Confira seu e-mail"
          description="Enviamos um link para confirmar sua conta. Ele vale por algumas horas."
        />
        <p className="mt-4 text-center text-sm text-text-muted">
          Já confirmou?{' '}
          <Link href="/entrar" className="font-medium text-accent-ink underline underline-offset-2">
            Entrar
          </Link>
        </p>
      </>
    )
  }

  const fields = state.status === 'error' ? state.fields : undefined

  return (
    <>
      <AuthHeading
        title="Criar sua conta"
        description="Faça parte da comunidade ColeXa e comece a organizar sua coleção."
      />

      <FormAlert message={state.status === 'error' ? state.message : undefined} />

      <form action={action} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="sr-only">
            Nome completo
          </label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            placeholder="Nome completo"
            {...bind('name')}
            icon={<User className="size-4" />}
            aria-invalid={fields?.name ? true : undefined}
            aria-describedby={fields?.name ? 'name-error' : undefined}
            required
          />
          <FieldError id="name-error" messages={fields?.name} />
        </div>

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
            {...bind('email')}
            icon={<Mail className="size-4" />}
            aria-invalid={fields?.email ? true : undefined}
            aria-describedby={fields?.email ? 'email-error' : undefined}
            required
          />
          <FieldError id="email-error" messages={fields?.email} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="sr-only">
            Senha
          </label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            placeholder="Senha"
            {...bind('password')}
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
            Confirmar senha
          </label>
          <PasswordInput
            id="passwordConfirmation"
            name="passwordConfirmation"
            autoComplete="new-password"
            placeholder="Confirmar senha"
            {...bind('passwordConfirmation')}
            aria-invalid={fields?.passwordConfirmation ? true : undefined}
            aria-describedby={
              fields?.passwordConfirmation ? 'passwordConfirmation-error' : undefined
            }
            required
          />
          <FieldError
            id="passwordConfirmation-error"
            messages={fields?.passwordConfirmation}
          />
        </div>

        <Checkbox
          id="acceptedTerms"
          name="acceptedTerms"
          error={fields?.acceptedTerms?.[0]}
          label={
            <>
              Concordo com os{' '}
              <Link href="/termos" className="text-accent-ink underline underline-offset-2">
                Termos de Uso
              </Link>{' '}
              e a{' '}
              <Link href="/privacidade" className="text-accent-ink underline underline-offset-2">
                Política de Privacidade
              </Link>
              .
            </>
          }
        />

        <SubmitButton>Criar conta</SubmitButton>
      </form>

      <SocialButtons providers={providers} />

      <p className="mt-8 text-center text-sm text-text-muted">
        Já tem uma conta?{' '}
        <Link href="/entrar" className="font-medium text-accent-ink underline underline-offset-2">
          Entrar
        </Link>
      </p>
    </>
  )
}
