import { BookOpen, Box, Layers, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Panel } from '@/components/ui/surface'

/**
 * Local de armazenamento: binder, caixa ou deck.
 *
 * O par tipo + finalidade nao e livre (`docs/business-rules.md` 3.1): binder e
 * caixa tem `COLLECTION` ou `TRADE`, e deck **nao tem finalidade**. Por isso
 * `purpose` e opcional no tipo e o rotulo omite a finalidade quando ela nao
 * existe, em vez de escrever "Deck • Coleção", que seria mentira.
 *
 * A validacao dessa combinacao e do servidor, e ja e feita por `CHECK` no
 * banco. Aqui e so exibicao.
 */

export type StorageType = 'BINDER' | 'BOX' | 'DECK'
export type StoragePurpose = 'COLLECTION' | 'TRADE'

const TYPE_LABEL: Record<StorageType, string> = {
  BINDER: 'Binder',
  BOX: 'Caixa',
  DECK: 'Deck',
}

const TYPE_ICON: Record<StorageType, React.ElementType> = {
  BINDER: BookOpen,
  BOX: Box,
  DECK: Layers,
}

const PURPOSE_LABEL: Record<StoragePurpose, string> = {
  COLLECTION: 'Coleção',
  TRADE: 'Troca',
}

export interface StorageCardProps {
  name: string
  type: StorageType
  /** Ausente em deck, por regra de negocio. */
  purpose?: StoragePurpose | null
  cardCount: number
  href?: string
  className?: string
}

export function StorageCard({
  name,
  type,
  purpose,
  cardCount,
  href,
  className,
}: StorageCardProps) {
  const Icon = TYPE_ICON[type]
  const subtitle = purpose
    ? `${TYPE_LABEL[type]} • ${PURPOSE_LABEL[purpose]}`
    : TYPE_LABEL[type]

  const content = (
    <>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-control bg-surface-muted text-text-muted">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold text-text">{name}</span>
        <span className="truncate text-xs text-text-muted">{subtitle}</span>
        <span className="text-xs text-text-subtle tabular-nums">
          {cardCount === 1 ? '1 carta' : `${cardCount} cartas`}
        </span>
      </span>
      {href ? <ChevronRight className="size-4 shrink-0 text-text-subtle" aria-hidden /> : null}
    </>
  )

  const classes = cn('flex w-full items-center gap-3 p-3 text-left', className)

  if (href) {
    return (
      <Panel className="transition-colors hover:bg-surface-muted">
        <a href={href} className={classes}>
          {content}
        </a>
      </Panel>
    )
  }
  return <Panel className={classes}>{content}</Panel>
}
