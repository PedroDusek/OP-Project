import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/badge'

/**
 * A carta na grade — o componente mais repetido do produto.
 *
 * ## A imagem nao passa pelo nosso servidor
 *
 * A decisao 020 obriga a **referenciar** a imagem na origem e nunca copiar nem
 * rearmazenar. `next/image` faria exatamente o contrario: o otimizador baixa o
 * arquivo, converte e serve de `/_next/image`, com cache no nosso disco. Isso e
 * rehospedar, e a mitigacao existe por motivo juridico, nao de performance.
 *
 * Entao aqui e `<img>` com `loading="lazy"` e `decoding="async"`, que da o
 * carregamento tardio sem intermediar o arquivo. O `aspect-[5/7]` reserva o
 * espaco antes da imagem chegar, que era o outro motivo para usar `next/image`.
 * Ver a decisao 026.
 *
 * ## Proporcao
 *
 * 5/7 e a proporcao da carta fisica. Fixa-la evita que a grade pule quando as
 * imagens chegam fora de ordem, e mantem as colunas alinhadas mesmo com uma
 * imagem faltando.
 */

export interface CardTileProps {
  code: string
  name: string
  imageUrl: string | null
  /** Copias possuidas. `0` aparece esmaecido, como nas telas de referencia. */
  quantity?: number
  /** Raridade, tipo de variante: "SR", "Alternate Art", "Manga Rare". */
  labels?: string[]
  href?: string
  onClick?: () => void
  /** Modo selecao da edicao em massa. */
  selectable?: boolean
  selected?: boolean
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
  className,
}: CardTileProps) {
  const owned = quantity !== undefined && quantity > 0

  const media = (
    <span
      className={cn(
        'relative block aspect-[5/7] w-full overflow-hidden rounded-card',
        'border border-border bg-surface-muted',
        selectable && selected && 'ring-2 ring-accent',
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- ver comentario acima
        <img
          src={imageUrl}
          alt={`${code} — ${name}`}
          loading="lazy"
          decoding="async"
          className={cn('size-full object-cover', quantity === 0 && 'opacity-55')}
        />
      ) : (
        <span className="flex size-full items-center justify-center px-1 text-center text-[10px] text-text-subtle">
          {code}
        </span>
      )}

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
 * colunas preservando a proporcao). A virtualizacao das listas longas entra com
 * as telas que trazem dados, no Checkpoint 7.
 */
export function CardGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8', className)}>
      {children}
    </div>
  )
}
