'use client'

import { Select as RadixSelect } from 'radix-ui'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { inputClassName } from './field'

/**
 * Lista de opcoes.
 *
 * Radix e nao `<select>` nativo porque as telas de referencia mostram opcoes
 * com mais que texto — local de armazenamento com icone, set com miniatura — e
 * `<option>` so aceita texto. O que o Radix devolve em troca e o teclado
 * completo do `<select>`: digitar para pular, setas, `Home` e `End`.
 *
 * O gatilho tem 44 px e o painel rola sozinho quando a lista e maior que a
 * tela, que e o caso de "todos os sets" com sessenta entradas.
 */

export interface SelectOption {
  value: string
  label: string
  /** Icone ou miniatura a esquerda do rotulo. */
  leading?: React.ReactNode
  disabled?: boolean
}

export interface SelectProps {
  value: string | undefined
  onValueChange: (value: string) => void
  options: SelectOption[]
  label: string
  placeholder?: string
  id?: string
  disabled?: boolean
  className?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

export function Select({
  value,
  onValueChange,
  options,
  label,
  placeholder = 'Selecione',
  id,
  disabled,
  className,
  ...aria
}: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RadixSelect.Trigger
        id={id}
        aria-label={label}
        className={cn(inputClassName, 'flex items-center justify-between gap-2 text-left', className)}
        {...aria}
      >
        <RadixSelect.Value placeholder={<span className="text-text-subtle">{placeholder}</span>} />
        <RadixSelect.Icon>
          <ChevronDown className="size-4 shrink-0 text-text-subtle" aria-hidden />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className={cn(
            'z-50 max-h-72 w-(--radix-select-trigger-width) overflow-hidden',
            'rounded-card border border-border bg-surface shadow-raised',
          )}
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-2 rounded-control px-2.5',
                  'text-sm text-text outline-none select-none',
                  'data-[highlighted]:bg-surface-muted',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
                )}
              >
                {option.leading ? <span className="shrink-0">{option.leading}</span> : null}
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="ml-auto">
                  <Check className="size-4 text-accent-ink" aria-hidden />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}
