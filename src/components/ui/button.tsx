import { Slot } from 'radix-ui'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Botao.
 *
 * Secao 3.4: raio de controle 8-12 px e alvo de toque de 44 px no minimo. O
 * tamanho `sm` fica em 36 px e por isso **nao serve para acao principal no
 * celular** — existe para botao dentro de linha de lista no desktop, onde o
 * ponteiro tem precisao. A regra de 44 px vale para o dedo.
 *
 * `disabled` nunca e so opacidade (secao 18: nao comunicar so por cor): o
 * cursor muda e o elemento sai da ordem de foco por ser um `<button disabled>`
 * de verdade.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-contrast hover:bg-accent-hover shadow-card',
  secondary: 'bg-surface text-text border border-border hover:bg-surface-muted',
  soft: 'bg-accent-soft text-accent-ink hover:brightness-95',
  ghost: 'text-text hover:bg-surface-muted',
  danger: 'bg-surface text-danger border border-danger/40 hover:bg-danger-soft',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-13 px-5 text-base gap-2',
}

export interface ButtonProps extends React.ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Ocupa a largura toda. E o padrao das acoes principais no celular. */
  block?: boolean
  /**
   * Mostra progresso e bloqueia o clique. Continua focavel de proposito: tirar
   * o foco do elemento no meio de uma acao joga o leitor de tela para o inicio
   * da pagina.
   */
  loading?: boolean
  /** Renderiza no elemento filho, para virar link sem perder a aparencia. */
  asChild?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  asChild = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const classes = cn(
    'inline-flex items-center justify-center rounded-control font-medium',
    'transition-colors select-none',
    'disabled:pointer-events-none disabled:opacity-45',
    'aria-disabled:pointer-events-none aria-disabled:opacity-45',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
    className,
  )

  /*
   * O ramo `asChild` nao passa pelo indicador de progresso, e isso e proposital
   * e nao economia: `Slot` exige **um** filho, e um link nao carrega. Envolver
   * o filho para caber o spinner devolveria dois nos ao Slot e quebraria em
   * tempo de execucao, que foi exatamente o que aconteceu aqui.
   */
  if (asChild) {
    return (
      <Slot.Root
        className={classes}
        aria-disabled={disabled || loading ? true : undefined}
        {...props}
      >
        {children}
      </Slot.Root>
    )
  }

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  )
}
