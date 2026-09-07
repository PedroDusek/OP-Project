import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/badge'

/**
 * Uma carta dentro de uma troca.
 *
 * O preco e opcional e sempre rotulado como **valor de mercado**. A secao 16 do
 * documento de marca pede essa separacao em voz alta: "custo" no One Piece e o
 * custo de jogo da carta, e chamar dinheiro de custo confunde as duas coisas na
 * mesma tela.
 *
 * Numa troca ja concluida, o valor exibido e o vigente na conclusao e nao muda
 * depois (`docs/business-rules.md` 5.1). Quem passa o valor resolve isso; o
 * componente so mostra o que recebeu.
 */

export interface TradeItemProps {
  code: string
  name: string
  imageUrl: string | null
  /** Rotulo da variante: "Normal", "Alt Art", "Manga Rare". */
  variantLabel?: string
  quantity: number
  /** Ja formatado em reais por quem chama. */
  marketValue?: string
  onRemove?: () => void
  className?: string
}

export function TradeItem({
  code,
  name,
  imageUrl,
  variantLabel,
  quantity,
  marketValue,
  onRemove,
  className,
}: TradeItemProps) {
  return (
    <div className={cn('flex items-center gap-3 py-2', className)}>
      <span className="relative block aspect-[5/7] w-10 shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- decisao 026
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : null}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-text tabular-nums">{code}</span>
        <span className="truncate text-xs text-text-muted">{name}</span>
        {variantLabel ? (
          <span className="mt-0.5">
            <Badge>{variantLabel}</Badge>
          </span>
        ) : null}
      </span>

      <span className="flex shrink-0 items-center gap-3">
        <span className="text-sm text-text-muted tabular-nums">×{quantity}</span>
        {marketValue ? (
          <span className="text-sm font-semibold text-text tabular-nums" title="Valor de mercado">
            {marketValue}
          </span>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remover ${code} da troca`}
            className="inline-flex size-11 items-center justify-center rounded-control text-text-subtle transition-colors hover:text-danger"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </span>
    </div>
  )
}
