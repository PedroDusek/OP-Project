'use client'

import { Switch as RadixSwitch } from 'radix-ui'
import { cn } from '@/lib/cn'

/**
 * Alternancia liga/desliga.
 *
 * Serve para o que tem efeito imediato — "Definir como disponivel para troca".
 * Para escolha que so vale depois de salvar, use caixa de selecao: a diferenca
 * entre as duas e justamente essa expectativa.
 *
 * O trilho tem 44 px de altura de alvo mesmo desenhando 24 px, e o rotulo faz
 * parte do alvo por estar dentro do `<label>`.
 */

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
  className?: string
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  className,
}: SwitchProps) {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-center justify-between gap-4',
        disabled && 'cursor-not-allowed opacity-45',
        className,
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-sm text-text">{label}</span>
        {description ? <span className="text-xs text-text-muted">{description}</span> : null}
      </span>
      <RadixSwitch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors outline-none',
          'bg-border-strong data-[state=checked]:bg-accent',
        )}
      >
        <RadixSwitch.Thumb
          className={cn(
            'block size-5 translate-x-0.5 rounded-full bg-white shadow-card',
            'transition-transform data-[state=checked]:translate-x-5.5',
          )}
        />
      </RadixSwitch.Root>
    </label>
  )
}
