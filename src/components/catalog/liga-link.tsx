import { ExternalLink } from 'lucide-react'
import type { LigaLink as LigaLinkData } from '@/server/domain/catalog/liga'
import { cn } from '@/lib/cn'

/**
 * "Veja na Liga": o link para esta carta na LigaOnePiece.
 *
 * Abre em aba nova de propósito. O produto não é um caminho para sair dele: sai
 * quem foi consultar preço e volta para registrar a carta, e perder a página
 * onde estava seria perder o motivo de ter ido.
 *
 * `rel="noopener noreferrer"` porque a página destino não deve ganhar
 * referência à nossa janela nem o endereço de onde a pessoa veio.
 *
 * O endereço chega pronto do caso de uso (decisão 071). Quando ele não é exato
 * — paralela ainda não conferida, promo sem número de edição —, vai para a busca
 * da Liga pelo código, e o rótulo diz isso. Prometer "a carta" e entregar uma
 * lista seria pior que avisar antes.
 */
export function LigaLink({ link, className }: { link: LigaLinkData; className?: string }) {
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex h-11 w-full items-center justify-center gap-2 rounded-control',
        'border border-border bg-surface px-4 text-sm font-medium text-text',
        'transition-colors hover:bg-surface-muted',
        className,
      )}
    >
      <ExternalLink className="size-4" aria-hidden />
      {link.exact ? 'Veja na Liga' : 'Buscar na Liga'}
      <span className="sr-only">(abre em uma nova aba)</span>
    </a>
  )
}
