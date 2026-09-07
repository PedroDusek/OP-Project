import { cn } from '@/lib/cn'

/**
 * Progresso de set ou de playset.
 *
 * Recebe `value` e `total` em vez de uma porcentagem pronta, por dois motivos.
 * O primeiro e acessibilidade: `aria-valuenow` com o minimo e o maximo reais
 * faz o leitor anunciar "124 de 125", que e a informacao. O segundo e que
 * arredondar cedo mente — 124/125 vira 99%, e 249/250 tambem, mas so um deles
 * esta a uma carta do fim.
 *
 * O calculo do que entra em `value` e `total` e do servidor
 * (`docs/business-rules.md` 2.2). Este componente so desenha.
 */

export interface ProgressBarProps {
  value: number
  total: number
  label: string
  /** Mostra "124 / 125" e a porcentagem acima da barra. */
  showNumbers?: boolean
  /** Barra fica verde ao chegar em 100%, como nas telas de referencia. */
  completeTone?: boolean
  className?: string
}

export function ProgressBar({
  value,
  total,
  label,
  showNumbers = false,
  completeTone = true,
  className,
}: ProgressBarProps) {
  const safeTotal = Math.max(total, 0)
  const safeValue = Math.min(Math.max(value, 0), safeTotal)
  // Set sem variante nenhuma nao e 100%, e dividir por zero seria NaN.
  const percent = safeTotal === 0 ? 0 : (safeValue / safeTotal) * 100
  const complete = safeTotal > 0 && safeValue === safeTotal

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {showNumbers ? (
        <div className="flex items-baseline justify-between text-xs text-text-muted tabular-nums">
          <span>
            {safeValue} / {safeTotal}
          </span>
          <span className={cn('font-semibold', complete && completeTone && 'text-success')}>
            {Math.round(percent)}%
          </span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={safeValue}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-valuetext={`${safeValue} de ${safeTotal}`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width]',
            complete && completeTone ? 'bg-success' : 'bg-accent-ink',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
