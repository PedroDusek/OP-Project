import { cn } from '@/lib/cn'

/**
 * Avatar com iniciais.
 *
 * Sem foto, mostra as iniciais do nome — e o "PD" das telas de referencia. As
 * iniciais sao decorativas: o nome ja aparece escrito ao lado ou no rotulo do
 * botao que contem o avatar, e repeti-lo faria o leitor de tela dizer tudo
 * duas vezes.
 *
 * Imagem de perfil nao entra neste checkpoint: nao existe upload nem coluna
 * para guardar a URL, e inventar uma seria decidir modelo de dados.
 */

export interface AvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-16 text-xl',
} as const

/** Primeira letra do primeiro e do ultimo nome. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'bg-accent font-semibold text-accent-contrast select-none',
        SIZES[size],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  )
}
