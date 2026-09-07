'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'
import { Logotype, Symbol } from '@/components/brand/logo'
import { DESTINATIONS, activeDestination } from './navigation'

/**
 * Navegacao lateral do tablet e do desktop.
 *
 * Secao 4: no desktop a navegacao pode migrar para sidebar, e o conteudo ganha
 * espaco **sem mudar a logica da experiencia**. Por isso sao os mesmos cinco
 * destinos, na mesma ordem, com o mesmo criterio de ativo — o que muda e onde
 * ficam.
 *
 * Duas larguras, nao duas navegacoes: no `md` so o icone cabe sem espremer a
 * grade de cartas, e a partir do `lg` entra o rotulo. O icone sozinho continua
 * tendo nome acessivel pelo `title`, e o rotulo escondido continua na arvore
 * de acessibilidade.
 */
export function SideNav() {
  const pathname = usePathname()
  const active = activeDestination(pathname)

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden border-r border-border bg-surface md:flex',
        'w-16 flex-col lg:w-56',
      )}
    >
      <Link
        href="/inicio"
        className="flex h-14 shrink-0 items-center justify-center px-3 lg:justify-start lg:px-4"
        aria-label="ColeXa, ir para o início"
      >
        <Symbol className="h-6 lg:hidden" label={null} />
        <Logotype className="hidden h-5 lg:block" label={null} />
      </Link>

      <ul className="flex flex-1 flex-col gap-1 p-2">
        {DESTINATIONS.map((destination) => {
          const Icon = destination.icon
          const current = destination.href === active?.href
          return (
            <li key={destination.href}>
              <Link
                href={destination.href}
                aria-current={current ? 'page' : undefined}
                title={destination.label}
                className={cn(
                  'flex h-11 items-center gap-3 rounded-control px-3 transition-colors',
                  'justify-center lg:justify-start',
                  current
                    ? 'bg-accent-soft font-semibold text-accent-ink'
                    : 'text-text-muted hover:bg-surface-muted hover:text-text',
                )}
              >
                <Icon className="size-5 shrink-0" strokeWidth={current ? 2.4 : 1.8} aria-hidden />
                <span className="hidden text-sm lg:inline">{destination.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
