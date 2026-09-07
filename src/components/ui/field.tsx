'use client'

import { useId } from 'react'
import { cn } from '@/lib/cn'

/**
 * Campo de formulario com rotulo, ajuda e erro.
 *
 * Secao 18: campos com labels acessiveis. O rotulo e um `<label htmlFor>` de
 * verdade, e nao um paragrafo por cima — a diferenca aparece ao tocar no
 * rotulo, que precisa focar o campo, e no leitor de tela, que precisa anunciar
 * os dois juntos.
 *
 * O erro e ligado por `aria-describedby` e marcado com `aria-invalid`, para que
 * a mensagem seja lida junto do campo e o estado nao dependa so da cor da
 * borda (secao 18: nao comunicar informacao somente por cor).
 */

export interface FieldProps {
  label: string
  /** Esconde o rotulo visualmente, sem tira-lo da arvore de acessibilidade. */
  hideLabel?: boolean
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: (props: {
    id: string
    'aria-describedby': string | undefined
    'aria-invalid': boolean | undefined
    required: boolean | undefined
  }) => React.ReactNode
}

export function Field({
  label,
  hideLabel = false,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={id}
        className={cn(
          'text-sm font-medium text-text',
          hideLabel && 'sr-only',
        )}
      >
        {label}
        {required ? (
          <span className="text-danger" aria-hidden>
            {' *'}
          </span>
        ) : null}
      </label>

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        required: required || undefined,
      })}

      {error ? (
        <p id={errorId} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-sm text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export const inputClassName = cn(
  'h-11 w-full rounded-control border border-border bg-surface px-3',
  'text-base text-text placeholder:text-text-subtle',
  'transition-colors outline-none',
  'focus-visible:border-accent-ink',
  'aria-[invalid=true]:border-danger',
  'disabled:cursor-not-allowed disabled:opacity-45',
)

export function Input({ className, ...props }: React.ComponentPropsWithoutRef<'input'>) {
  return <input className={cn(inputClassName, className)} {...props} />
}

export function Textarea({ className, ...props }: React.ComponentPropsWithoutRef<'textarea'>) {
  return <textarea className={cn(inputClassName, 'h-auto min-h-24 py-2.5', className)} {...props} />
}
