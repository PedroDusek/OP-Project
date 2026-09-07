import { cn } from '@/lib/cn'
import { Panel } from '@/components/ui/surface'

/**
 * Numero grande com rotulo: "1.284 Cartas", "186 Playsets".
 *
 * O numero vem formatado de quem chama. Formatar aqui exigiria saber se aquilo
 * e contagem ou dinheiro, e `components/` nao calcula nada (`architecture.md`
 * 2.1: todo numero exibido e calculado no servidor).
 *
 * `tabular-nums` mantem os digitos com a mesma largura, para os quatro
 * quadrados da Home nao dancarem quando um valor muda de 999 para 1.000.
 */

export interface StatTileProps {
  value: string
  label: string
  icon?: React.ReactNode
  className?: string
}

export function StatTile({ value, label, icon, className }: StatTileProps) {
  return (
    <Panel className={cn('flex items-center gap-3 p-3', className)}>
      {icon ? (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent-ink">
          {icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-lg font-bold text-text tabular-nums">{value}</span>
        <span className="truncate text-xs text-text-muted">{label}</span>
      </span>
    </Panel>
  )
}
