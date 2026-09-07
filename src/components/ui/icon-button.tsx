import { cn } from '@/lib/cn'

/**
 * Botao so com icone.
 *
 * `label` e obrigatorio, e nao opcional com um padrao: um botao que so tem
 * icone nao tem nome acessivel nenhum, e quem usa leitor de tela ouviria
 * "botao". Deixar isso passar e o jeito mais comum de tornar uma barra de
 * navegacao inutilizavel sem enxergar.
 *
 * O alvo de toque e 44 px (secao 3.4) mesmo quando o icone desenhado e menor:
 * o dedo mira a area, nao o desenho.
 */

export interface IconButtonProps extends Omit<React.ComponentPropsWithoutRef<'button'>, 'children'> {
  /** Nome acessivel. Aparece como `aria-label` e como tooltip nativa. */
  label: string
  children: React.ReactNode
  /** Marca o botao como ativo, para alternancias como favoritar. */
  pressed?: boolean
}

export function IconButton({ label, children, pressed, className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-control',
        'text-text transition-colors hover:bg-surface-muted',
        'disabled:pointer-events-none disabled:opacity-45',
        pressed && 'text-accent-ink',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
