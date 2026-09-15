import { ExternalLink } from 'lucide-react'
import type { LigaLink as LigaLinkData } from '@/server/domain/catalog/liga'
import { cn } from '@/lib/cn'

/**
 * Os links para a carta fora do produto: "Veja na Liga" e "Veja no TCGplayer".
 *
 * Abrem em aba nova de propósito. O produto não é um caminho para sair dele: sai
 * quem foi consultar preço e volta para registrar a carta, e perder a página
 * onde estava seria perder o motivo de ter ido.
 *
 * `rel="noopener noreferrer"` porque a página destino não deve ganhar
 * referência à nossa janela nem o endereço de onde a pessoa veio.
 */

function ExternalButton({
  href,
  children,
  className,
}: {
  href: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <a
      href={href}
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
      {children}
      <span className="sr-only">(abre em uma nova aba)</span>
    </a>
  )
}

/**
 * O endereço chega pronto do caso de uso (decisão 071). Quando ele não é exato
 * — paralela sem página conferida, promo sem número de edição —, vai para a busca
 * da Liga pelo código, e o rótulo diz isso. Prometer "a carta" e entregar uma
 * lista seria pior que avisar antes.
 */
export function LigaLink({ link, className }: { link: LigaLinkData; className?: string }) {
  return (
    <ExternalButton href={link.href} className={className}>
      {link.exact ? 'Veja na Liga' : 'Buscar na Liga'}
    </ExternalButton>
  )
}

/**
 * A página do produto no TCGplayer, que é de onde vem o preço da tela (decisão
 * 047). Só existe com vínculo — sem ele, o componente não desenha nada
 * (`domain/prices/tcgplayer-link.ts`).
 */
export function TcgplayerLink({ href, className }: { href: string | null; className?: string }) {
  if (!href) return null
  return (
    <ExternalButton href={href} className={className}>
      Veja no TCGplayer
    </ExternalButton>
  )
}
