'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Chip de filtro.
 *
 * Selecionado nao e so a cor de fundo: entra tambem `aria-pressed`, e a opcao
 * de mostrar um confere. Secao 18 pede que informacao nao dependa so de cor, e
 * a diferenca entre `bg-accent-soft` e `bg-surface-muted` e justamente o tipo
 * de contraste que se perde em tela sob sol ou em daltonismo.
 *
 * O chip nao guarda estado. Ele e um botao com aparencia; a lista de filtros
 * ativos pertence a tela, que precisa saber disso para consultar o servidor.
 */

export interface ChipProps extends Omit<React.ComponentPropsWithoutRef<'button'>, 'children'> {
  children: React.ReactNode
  selected?: boolean
  /** Contagem ao lado do rotulo, como em "Possuo (3)". */
  count?: number
  /** Desenha o confere quando selecionado. */
  showCheck?: boolean
}

export function Chip({
  children,
  selected = false,
  count,
  showCheck = false,
  className,
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5',
        'text-sm font-medium whitespace-nowrap transition-colors',
        'border',
        selected
          ? 'border-accent-ink/30 bg-accent-soft text-accent-ink'
          : 'border-border bg-surface text-text-muted hover:bg-surface-muted',
        'disabled:pointer-events-none disabled:opacity-45',
        className,
      )}
      {...props}
    >
      {showCheck && selected ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
      {children}
      {count !== undefined ? (
        <span className={cn(selected ? 'text-accent-ink/80' : 'text-text-subtle')}>({count})</span>
      ) : null}
    </button>
  )
}

/**
 * Faixa horizontal de chips.
 *
 * Rolagem horizontal com `scrollbar` escondida e o padrao das telas de
 * referencia. `role="group"` com rotulo diz ao leitor de tela que os botoes
 * pertencem ao mesmo conjunto de filtros.
 */
export function ChipBar({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex gap-2 overflow-x-auto',
        // A faixa sangra ate a borda da tela, mas o primeiro e o ultimo chip
        // respeitam a margem do conteudo.
        '-mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {children}
    </div>
  )
}
