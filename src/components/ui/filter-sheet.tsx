'use client'

import { cn } from '@/lib/cn'
import { Button } from './button'
import { Sheet } from './sheet'

/**
 * O painel de filtros.
 *
 * Existe como composicao propria, e nao como um `Sheet` montado a mao em cada
 * tela, porque ele aparece identico em quatro lugares — catalogo, colecao,
 * armazenamento e edicao em massa — e a secao 20 cobra que filtros sejam
 * consistentes. Repetir a estrutura em quatro arquivos e o caminho conhecido
 * para os quatro divergirem.
 *
 * O rodape fica fora da area que rola: numa lista longa de filtros no celular,
 * "Aplicar" no fim do scroll obriga a percorrer tudo de novo so para confirmar.
 */

export interface FilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  onApply: () => void
  onClear: () => void
  /** Quantos filtros estao ativos, para o rotulo do botao. */
  activeCount?: number
  children: React.ReactNode
}

export function FilterSheet({
  open,
  onOpenChange,
  title = 'Filtros',
  onApply,
  onClear,
  activeCount,
  children,
}: FilterSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" block onClick={onClear}>
            Limpar
          </Button>
          <Button block onClick={onApply}>
            Aplicar filtros
            {activeCount ? ` (${activeCount})` : ''}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">{children}</div>
    </Sheet>
  )
}

/** Um bloco de filtro, com titulo. */
export function FilterSection({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn('flex flex-col gap-2', className)}>
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {children}
    </section>
  )
}
