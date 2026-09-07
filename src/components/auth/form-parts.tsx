'use client'

import { useFormStatus } from 'react-dom'
import { CircleAlert, MailCheck } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import type { AuthFormState } from '@/app/(auth)/state'

/**
 * As peças que as quatro telas de conta compartilham.
 *
 * Estão juntas porque a diferença entre entrar e cadastrar é a lista de campos,
 * não o comportamento: as duas mostram o mesmo tipo de erro no mesmo lugar,
 * desabilitam o botão do mesmo jeito e confirmam o envio da mesma forma.
 */

export function AuthHeading({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="mb-6 flex flex-col gap-2">
      <h1 className="text-3xl leading-tight font-bold tracking-tight text-text">{title}</h1>
      {description ? <p className="text-base text-text-muted">{description}</p> : null}
    </div>
  )
}

/**
 * Erro que vale para o formulário inteiro: senha errada, limite de tentativas,
 * falha do provedor.
 *
 * `role="alert"` para o leitor de tela anunciar assim que aparece. Sem isso, a
 * pessoa que não enxerga só descobriria que o login falhou ao percorrer a
 * página de novo procurando o motivo.
 */
export function FormAlert({ message }: { message?: string }) {
  if (!message) return null

  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2.5 rounded-control border border-danger/30 bg-danger-soft px-3 py-2.5"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
      <p className="text-sm text-text">{message}</p>
    </div>
  )
}

/** Mensagens de erro de um campo, ligadas a ele por `aria-describedby`. */
export function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null
  return (
    <p id={id} className="text-sm text-danger" role="alert">
      {messages[0]}
    </p>
  )
}

/**
 * Botão de envio que conhece o estado do formulário.
 *
 * Usa `useFormStatus` em vez de um `useState` próprio para que o estado venha
 * do envio de verdade: com estado próprio, um erro no servidor deixaria o botão
 * girando para sempre.
 */
export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" block size="lg" loading={pending}>
      {children}
    </Button>
  )
}

/**
 * Confirmação de que o e-mail saiu.
 *
 * Aparece depois do cadastro e depois de pedir redefinição de senha. Diz o
 * endereço de volta porque errar uma letra no próprio e-mail é o motivo mais
 * comum de a mensagem "não chegar".
 */
export function SentToEmail({
  state,
  title,
  description,
  className,
}: {
  state: AuthFormState
  title: string
  description: string
  className?: string
}) {
  if (state.status !== 'sent') return null

  return (
    <div className={cn('flex flex-col items-center gap-3 py-6 text-center', className)}>
      <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
        <MailCheck className="size-7" aria-hidden />
      </span>
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      <p className="text-sm text-text-muted">{description}</p>
      <p className="text-sm font-medium text-text break-all">{state.email}</p>
      <p className="mt-2 text-xs text-text-subtle">
        Não chegou? Confira a caixa de spam e o endereço acima.
      </p>
    </div>
  )
}
