'use client'

import { cn } from '@/lib/cn'

/**
 * Alternancia entre visoes do mesmo conteudo: "Todas / Possuo / Faltam",
 * "Grid / Lista".
 *
 * Diferente do `Chip`, que e filtro combinavel: aqui as opcoes sao mutuamente
 * exclusivas e sempre ha uma ativa. Por isso vira `role="tablist"` com
 * `aria-selected`, e nao um punhado de `aria-pressed` — o leitor de tela
 * anuncia "aba 2 de 3" em vez de tres botoes soltos.
 *
 * As setas do teclado navegam entre as opcoes, como manda o padrao de abas.
 */

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  count?: number
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onValueChange: (value: T) => void
  label: string
  className?: string
}

export function Segmented<T extends string>({
  options,
  value,
  onValueChange,
  label,
  className,
}: SegmentedProps<T>) {
  const move = (from: number, delta: number) => {
    const next = (from + delta + options.length) % options.length
    onValueChange(options[next].value)
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'flex gap-2 overflow-x-auto',
        '-mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            // Só a opcao ativa fica na ordem de tabulacao: o teclado entra no
            // grupo uma vez e caminha com as setas, em vez de parar em cada uma.
            tabIndex={selected ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') move(index, 1)
              else if (event.key === 'ArrowLeft') move(index, -1)
              else return
              event.preventDefault()
            }}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5',
              'text-sm font-medium whitespace-nowrap transition-colors',
              selected
                ? 'border-accent-ink/30 bg-accent-soft text-accent-ink'
                : 'border-border bg-surface text-text-muted hover:bg-surface-muted',
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span className={selected ? 'text-accent-ink/80' : 'text-text-subtle'}>
                ({option.count})
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
