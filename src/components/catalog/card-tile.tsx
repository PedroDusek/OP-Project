import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/badge'
import { CardArt } from './card-art'

/**
 * A carta na grade — o componente mais repetido do produto.
 *
 * A arte fica em `CardArt`, que explica por que ela passa pelo nosso servidor.
 */

export interface CardTileProps {
  code: string
  name: string
  imageUrl: string | null
  /** Copias possuidas. `0` aparece esmaecido, como nas telas de referencia. */
  quantity?: number
  /** Raridade, tipo de variante: "SR", "Parallel". */
  labels?: string[]
  href?: string
  onClick?: () => void
  /** Modo selecao da edicao em massa. */
  selectable?: boolean
  selected?: boolean
  /** Carrega sem esperar a rolagem. Para as primeiras cartas da grade. */
  priority?: boolean
  className?: string
}

export function CardTile({
  code,
  name,
  imageUrl,
  quantity,
  labels,
  href,
  onClick,
  selectable = false,
  selected = false,
  priority = false,
  className,
}: CardTileProps) {
  const owned = quantity !== undefined && quantity > 0

  const media = (
    <span className="relative block">
      <CardArt
        src={imageUrl}
        alt={`${code} — ${name}`}
        fallback={code}
        priority={priority}
        className={cn(
          selectable && selected && 'ring-2 ring-accent',
          quantity === 0 && 'opacity-55',
        )}
      />

      {quantity !== undefined ? (
        <span
          className={cn(
            'absolute right-1 bottom-1 rounded-md px-1.5 py-0.5',
            'text-xs font-bold tabular-nums',
            // Fundo proprio: o badge fica sobre arte de qualquer cor, e um
            // token de superficie nao garantiria contraste ali.
            owned ? 'bg-black/75 text-white' : 'bg-black/55 text-white/70',
          )}
        >
          x{quantity}
        </span>
      ) : null}

      {selectable ? (
        <span
          className={cn(
            'absolute top-1 right-1 flex size-5 items-center justify-center rounded-full border-2',
            selected ? 'border-accent bg-accent text-accent-contrast' : 'border-white/80 bg-black/30',
          )}
          aria-hidden
        >
          {selected ? <Check className="size-3" /> : null}
        </span>
      ) : null}
    </span>
  )

  const caption = (
    <span className="flex flex-col gap-0.5">
      <span className="truncate text-xs font-semibold text-text tabular-nums">{code}</span>
      <span className="truncate text-xs text-text-muted">{name}</span>
      {labels?.length ? (
        <span className="mt-0.5 flex flex-wrap gap-1">
          {labels.map((label) => (
            <Badge key={label} tone="accent">
              {label}
            </Badge>
          ))}
        </span>
      ) : null}
    </span>
  )

  const classes = cn('flex flex-col gap-1.5 text-left', className)

  if (href) {
    return (
      <a href={href} className={classes}>
        {media}
        {caption}
      </a>
    )
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selectable ? selected : undefined}
        className={classes}
      >
        {media}
        {caption}
      </button>
    )
  }
  return (
    <div className={classes}>
      {media}
      {caption}
    </div>
  )
}

/**
 * Grade de cartas.
 *
 * Tres colunas no celular, crescendo com a largura (secao 18: a grade ganha
 * colunas preservando a proporcao).
 */
export function CardGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8', className)}>
      {children}
    </div>
  )
}
