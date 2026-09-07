'use client'

import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Seletor de quantidade: menos, numero, mais.
 *
 * Os dois botoes tem 44 px e ficam nas pontas, alcancaveis com um polegar so
 * (`architecture.md` 4.1). O numero no meio e um `<input type="text"
 * inputMode="numeric">` e nao `type="number"`: o campo numerico do navegador
 * traz setas proprias que competem com estes botoes, e no celular abre um
 * teclado com virgula e sinal que nao servem para contar copias.
 *
 * Este componente **nao persiste nada**. Reduzir a quantidade abaixo do que ja
 * esta alocado devolve conflito do servidor com as alocacoes atuais, para a
 * pessoa escolher de onde as copias saem (`docs/business-rules.md` 3.3). Essa
 * tela de resolucao e do Checkpoint 9; aqui so existe o controle.
 */

export interface QuantitySelectorProps {
  value: number
  onValueChange: (value: number) => void
  label: string
  min?: number
  max?: number
  disabled?: boolean
  size?: 'md' | 'lg'
  className?: string
}

export function QuantitySelector({
  value,
  onValueChange,
  label,
  min = 0,
  max = 9999,
  disabled = false,
  size = 'md',
  className,
}: QuantitySelectorProps) {
  const clamp = (next: number) => Math.min(Math.max(next, min), max)
  const button = size === 'lg' ? 'size-13' : 'size-11'

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        aria-label={`Diminuir ${label}`}
        disabled={disabled || value <= min}
        onClick={() => onValueChange(clamp(value - 1))}
        className={cn(
          button,
          'inline-flex shrink-0 items-center justify-center rounded-control',
          'border border-border bg-surface text-text transition-colors',
          'hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <Minus className="size-4" aria-hidden />
      </button>

      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={label}
        disabled={disabled}
        value={value}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '')
          // Campo vazio vira o minimo em vez de NaN: apagar tudo para digitar
          // outro numero e o gesto normal, e nao pode quebrar a tela no meio.
          onValueChange(clamp(digits === '' ? min : Number(digits)))
        }}
        className={cn(
          'h-11 min-w-0 flex-1 rounded-control border border-border bg-surface',
          'text-center text-base font-semibold text-text tabular-nums',
          'outline-none transition-colors focus-visible:border-accent-ink',
          'disabled:opacity-45',
          size === 'lg' && 'h-13 text-lg',
        )}
      />

      <button
        type="button"
        aria-label={`Aumentar ${label}`}
        disabled={disabled || value >= max}
        onClick={() => onValueChange(clamp(value + 1))}
        className={cn(
          button,
          'inline-flex shrink-0 items-center justify-center rounded-control',
          'border border-accent-ink/30 bg-accent-soft text-accent-ink transition-colors',
          'hover:brightness-95 disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  )
}
