'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { signInAction } from '../actions'
import { IDLE } from '../state'
import { AuthHeading, FieldError, FormAlert, SubmitButton } from '@/components/auth/form-parts'
import { SocialButtons } from '@/components/auth/social-buttons'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'
import type { OAuthProviderId } from '@/server/http/auth-provider'

/**
 * Entrar.
 *
 * ## Por que os campos são controlados
 *
 * O React **reseta** um `<form action={...}>` depois que a ação termina, e isso
 * vale também quando ela termina em erro. Com campos não controlados, uma senha
 * errada apagava o e-mail já digitado, e a segunda tentativa começava do zero —
 * o caminho curto para o segundo erro ser de digitação.
 *
 * Guardar o valor em estado é o que sobrevive a esse reset. Foi um teste ponta a
 * ponta que mostrou o problema; o comentário anterior aqui afirmava o oposto.
 */
export function SignInForm({
  providers,
  next,
  initialError,
}: {
  providers: OAuthProviderId[]
  next?: string
  initialError?: string
}) {
  const [state, action] = useActionState(signInAction, IDLE)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const fields = state.status === 'error' ? state.fields : undefined
  // O erro vindo da query é o do retorno do provedor social, que acontece antes
  // de qualquer envio deste formulário.
  const message = state.status === 'error' ? state.message : initialError

  return (
    <>
      <AuthHeading title="Bem-vindo de volta!" description="Entre na sua conta e continue de onde parou." />

      <FormAlert message={message} />

      <form action={action} className="flex flex-col gap-4" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}

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
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
            autoComplete="current-password"
            placeholder="Senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={fields?.password ? true : undefined}
            aria-describedby={fields?.password ? 'password-error' : undefined}
            required
          />
          <FieldError id="password-error" messages={fields?.password} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <Checkbox id="remember" name="remember" defaultChecked label="Lembrar de mim" />
          <Link
            href="/recuperar-senha"
            className="text-sm font-medium text-accent-ink underline underline-offset-2"
          >
            Esqueci minha senha
          </Link>
        </div>

        <SubmitButton>Entrar</SubmitButton>
      </form>

      <SocialButtons providers={providers} next={next} />

      <p className="mt-8 text-center text-sm text-text-muted">
        Não tem uma conta?{' '}
        <Link href="/criar-conta" className="font-medium text-accent-ink underline underline-offset-2">
          Criar conta
        </Link>
      </p>
    </>
  )
}
