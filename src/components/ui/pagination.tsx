import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Paginação por link.
 *
 * São `<a>` de verdade, e não botões que buscam em JavaScript, e isso é uma
 * escolha e não uma economia. A página fica no endereço, então a lista volta
 * igual pelo histórico, é compartilhável, e o servidor entrega já renderizada.
 *
 * Rolagem infinita foi considerada e ficou para quando alguém precisar dela: em
 * uma ferramenta de coleção, "a página 7 de OP01" é um lugar ao qual se volta, e
 * rolagem infinita não tem endereço.
 *
 * `aria-disabled` em vez de sumir com o link nas pontas: um alvo que aparece e
 * desaparece muda a posição dos outros a cada página.
 */

export interface PaginationProps {
  page: number
  totalPages: number
  /** Recebe a página e devolve o href. Quem chama sabe montar a query. */
  hrefFor: (page: number) => string
  className?: string
}

export function Pagination({ page, totalPages, hrefFor, className }: PaginationProps) {
  if (totalPages <= 1) return null

  const previous = Math.max(1, page - 1)
  const next = Math.min(totalPages, page + 1)
  const atStart = page <= 1
  const atEnd = page >= totalPages

  const step = cn(
    'inline-flex h-11 items-center gap-1 rounded-control border border-border px-3',
    'text-sm font-medium text-text transition-colors hover:bg-surface-muted',
    'aria-disabled:pointer-events-none aria-disabled:opacity-40',
  )

  return (
    <nav aria-label="Paginação" className={cn('flex items-center justify-between gap-3', className)}>
      <Link href={hrefFor(previous)} aria-disabled={atStart} tabIndex={atStart ? -1 : undefined} className={step}>
        <ChevronLeft className="size-4" aria-hidden />
        Anterior
      </Link>

      <span className="text-sm text-text-muted tabular-nums" aria-live="polite">
        Página {page} de {totalPages}
      </span>

      <Link href={hrefFor(next)} aria-disabled={atEnd} tabIndex={atEnd ? -1 : undefined} className={step}>
        Próxima
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </nav>
  )
}
