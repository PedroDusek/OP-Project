'use client'

import { Checkbox as RadixCheckbox } from 'radix-ui'
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Caixa de selecao.
 *
 * Diferente do `Switch`: a caixa serve para escolha que so vale quando o
 * formulario e enviado — aceitar os termos, lembrar de mim. O interruptor serve
 * para o que tem efeito imediato. Trocar os dois faz a pessoa esperar por algo
 * que ja aconteceu, ou achar que aconteceu algo que ainda nao foi enviado.
 *
 * `name` existe porque estas caixas vivem dentro de `<form>` enviado a uma
 * Server Action: o Radix mantem um input escondido para o valor chegar no
 * `FormData`.
 *
 * O rotulo faz parte do alvo, e o conjunto tem 44 px de altura mesmo com a
 * caixa desenhada em 20.
 */

export interface CheckboxProps {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  /** Texto ao lado. Aceita nó para caber links, como nos termos. */
  label: React.ReactNode
  /** Nome do campo no envio do formulário. */
  name?: string
  value?: string
  disabled?: boolean
  /** Mensagem de erro ligada por `aria-describedby`. */
  error?: string
  id?: string
  className?: string
}

export function Checkbox({
  checked,
  defaultChecked,
  onCheckedChange,
  label,
  name,
  value,
  disabled,
  error,
  id,
  className,
}: CheckboxProps) {
  const errorId = error && id ? `${id}-error` : undefined

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex min-h-11 items-center gap-2.5">
        <RadixCheckbox.Root
          id={id}
          name={name}
          value={value}
          checked={checked}
          defaultChecked={defaultChecked}
          onCheckedChange={(next) => onCheckedChange?.(next === true)}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors',
            'border-border-strong bg-surface',
            'data-[state=checked]:border-accent data-[state=checked]:bg-accent',
            'aria-[invalid=true]:border-danger',
            'disabled:opacity-45',
          )}
        >
          <RadixCheckbox.Indicator>
            <Check className="size-3.5 text-accent-contrast" strokeWidth={3} aria-hidden />
          </RadixCheckbox.Indicator>
        </RadixCheckbox.Root>

        <label
          htmlFor={id}
          className={cn(
            'cursor-pointer text-sm leading-snug text-text',
            disabled && 'cursor-not-allowed opacity-45',
          )}
        >
          {label}
        </label>
      </div>

      {error ? (
        <p id={errorId} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
