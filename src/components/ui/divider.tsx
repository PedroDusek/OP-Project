import { cn } from '@/lib/cn'

/**
 * Separador com rótulo no meio — o "ou" entre entrar com senha e entrar com um
 * provedor.
 *
 * Duas linhas com texto no meio, e não uma `<hr>` com texto por cima, para o
 * rótulo não precisar de fundo opaco: sobre superfície com transparência, esse
 * truque aparece.
 */
export function Divider({ label, className }: { label?: string; className?: string }) {
  if (!label) return <hr className={cn('border-border', className)} />

  return (
    <div className={cn('flex items-center gap-3', className)} role="separator">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium text-text-subtle">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
