'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/cn'
import { THEMES, type Theme } from '@/lib/theme'
import { useTheme } from './theme-provider'

/**
 * Escolha de tema: sistema, claro ou escuro.
 *
 * Tres opcoes e nao um interruptor. Um interruptor claro/escuro parece mais
 * simples e e pior: a pessoa que abre o app pela primeira vez ja esta em
 * "sistema", e o primeiro toque a tira dali para sempre — depois disso, mudar o
 * tema do celular a noite nao muda mais o app, e nao ha caminho de volta.
 *
 * `radiogroup` porque as opcoes sao exclusivas e sempre ha uma escolhida.
 */

const OPTIONS: Record<Theme, { label: string; icon: React.ElementType }> = {
  system: { label: 'Sistema', icon: Monitor },
  light: { label: 'Claro', icon: Sun },
  dark: { label: 'Escuro', icon: Moon },
}

export function ThemeControl({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="radiogroup"
      aria-label="Tema da interface"
      className={cn('grid grid-cols-3 gap-2', className)}
    >
      {THEMES.map((option) => {
        const { label, icon: Icon } = OPTIONS[option]
        const selected = theme === option
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(option)}
            className={cn(
              'flex h-16 flex-col items-center justify-center gap-1 rounded-control border',
              'text-xs font-medium transition-colors',
              selected
                ? 'border-accent-ink/40 bg-accent-soft text-accent-ink'
                : 'border-border bg-surface text-text-muted hover:bg-surface-muted',
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </button>
        )
      })}
    </div>
  )
}
