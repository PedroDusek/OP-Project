'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'
import { DESTINATIONS, activeDestination } from './navigation'

/**
 * Barra de navegacao inferior.
 *
 * Secao 4: persistente nas areas principais do celular, identificando com
 * clareza a secao ativa. Some a partir do `md`, onde a coluna lateral assume.
 *
 * A secao ativa e marcada de tres formas ao mesmo tempo — cor, peso da fonte e
 * `aria-current="page"` — porque a secao 18 pede que informacao nao dependa so
 * de cor, e porque `aria-current` e o que faz o leitor de tela anunciar "pagina
 * atual" em vez de mais um link.
 *
 * Cada item tem 44 px de altura util e divide a largura igualmente: no celular
 * o polegar mira a coluna, nao o icone.
 */
export function BottomNav() {
  const pathname = usePathname()
  const active = activeDestination(pathname)

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface md:hidden',
        // A barra some no teclado virtual do iOS sem isto, e o gesto de voltar
        // do Android encosta nos icones.
        'pb-safe',
      )}
    >
      <ul className="flex">
        {DESTINATIONS.map((destination) => {
          const Icon = destination.icon
          const current = destination.href === active?.href
          return (
            <li key={destination.href} className="flex-1">
              <Link
                href={destination.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-0.5 transition-colors',
                  current ? 'text-accent-ink' : 'text-text-muted hover:text-text',
                )}
              >
                <Icon
                  className="size-5 shrink-0"
                  strokeWidth={current ? 2.4 : 1.8}
                  aria-hidden
                />
                <span className={cn('text-[11px]', current ? 'font-semibold' : 'font-medium')}>
                  {destination.label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
