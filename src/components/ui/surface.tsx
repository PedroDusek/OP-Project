import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Superficies e linhas de lista.
 *
 * Secao 3.4: card com raio 12-16 px, sombra sutil, borda de 1 px discreta. Sao
 * as tres propriedades juntas que dao a separacao no tema claro, onde o branco
 * do card e o cinza do fundo estao a poucos passos de distancia.
 */

export function Panel({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn(
        'rounded-card border border-border bg-surface shadow-card',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/** Painel dividido em linhas, como as listas de Armazenamento e Perfil. */
export function PanelList({ className, children, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <Panel className={cn('divide-y divide-border overflow-hidden', className)} {...props}>
      {children}
    </Panel>
  )
}

export interface ListRowProps {
  /** Icone ou miniatura a esquerda. */
  leading?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** Conteudo a direita, antes da seta. */
  trailing?: React.ReactNode
  /** Com `href` a linha vira link; sem ele e `onClick`, vira botao. */
  href?: string
  onClick?: () => void
  /** Some com a seta em linhas que abrem algo que nao e outra tela. */
  hideChevron?: boolean
  tone?: 'default' | 'danger'
  className?: string
}

/**
 * Linha de lista.
 *
 * A linha inteira e o alvo, e nao so o texto: no celular, mirar uma palavra de
 * 14 px e pior do que mirar uma faixa de 64 px. Por isso ela vira `<a>` ou
 * `<button>` de verdade — assim ganha foco de teclado e menu de contexto sem
 * nenhum `onKeyDown` escrito a mao.
 */
export function ListRow({
  leading,
  title,
  description,
  trailing,
  href,
  onClick,
  hideChevron = false,
  tone = 'default',
  className,
}: ListRowProps) {
  const interactive = Boolean(href || onClick)

  const content = (
    <>
      {leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span
          className={cn(
            'truncate text-sm font-medium',
            tone === 'danger' ? 'text-danger' : 'text-text',
          )}
        >
          {title}
        </span>
        {description ? (
          <span className="truncate text-xs text-text-muted">{description}</span>
        ) : null}
      </span>
      {trailing ? <span className="flex shrink-0 items-center gap-2">{trailing}</span> : null}
      {interactive && !hideChevron ? (
        <ChevronRight className="size-4 shrink-0 text-text-subtle" aria-hidden />
      ) : null}
    </>
  )

  const classes = cn(
    'flex w-full min-h-14 items-center gap-3 px-4 py-3',
    interactive && 'transition-colors hover:bg-surface-muted',
    className,
  )

  if (href) {
    return (
      <a href={href} className={classes}>
        {content}
      </a>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {content}
      </button>
    )
  }
  return <div className={classes}>{content}</div>
}
