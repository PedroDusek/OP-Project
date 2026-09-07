import { cn } from '@/lib/cn'

/**
 * Etiqueta curta: raridade, tipo de variante, status de troca.
 *
 * Toda variante carrega o significado no texto, nunca so na cor. Um badge
 * verde sem palavra nao diz nada a quem nao distingue verde de vermelho
 * (secao 18).
 */

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger' | 'warning'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-text-muted',
  accent: 'bg-accent-soft text-accent-ink',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
}

export interface BadgeProps extends React.ComponentPropsWithoutRef<'span'> {
  tone?: BadgeTone
}

export function Badge({ tone = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5',
        'text-xs font-semibold whitespace-nowrap',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

/**
 * Estado de uma negociacao.
 *
 * Os estados sao os do ciclo de vida do trade em `docs/business-rules.md` 4.5,
 * e nao ha outros. O ponto colorido e redundante de proposito: o rotulo ja diz
 * tudo, e o ponto so ajuda quem ja sabe a cor.
 */
export type TradeStatus =
  | 'DRAFT'
  | 'PROPOSED'
  | 'NEGOTIATING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'

const STATUS: Record<TradeStatus, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: 'Rascunho', tone: 'neutral' },
  PROPOSED: { label: 'Proposta enviada', tone: 'accent' },
  NEGOTIATING: { label: 'Em negociação', tone: 'accent' },
  CONFIRMED: { label: 'Confirmada', tone: 'warning' },
  COMPLETED: { label: 'Concluída', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'danger' },
}

export function StatusBadge({ status, className }: { status: TradeStatus; className?: string }) {
  const { label, tone } = STATUS[status]
  return (
    <Badge tone={tone} className={cn('gap-1.5', className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </Badge>
  )
}
