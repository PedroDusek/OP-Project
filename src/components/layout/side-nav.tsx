'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'
import { Logotype } from '@/components/brand/logo'
import { ACCOUNT, DESTINATIONS, activeDestination } from './navigation'

/**
 * Navegacao lateral do tablet e do desktop.
 *
 * ## Sempre com rotulo
 *
 * Antes ela tinha duas larguras: so icone no `md`, rotulo a partir do `lg`. O
 * dono do produto pediu para abrir de vez — no computador ha espaco de sobra, e
 * um icone sem palavra ao lado e um enigma que a pessoa resolve por tentativa.
 *
 * ## A conta fica no rodape, separada por uma linha
 *
 * Ela nao e um lugar onde se faz coisa, e sim onde se ve quem voce e e se
 * ajusta o produto. No meio da lista, obrigaria a pessoa a passar por
 * configuracao para chegar ao catalogo.
 */
export function SideNav() {
  const pathname = usePathname()
  const active = activeDestination(pathname)

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-border bg-surface md:flex',
        // Ver `AppShell`: navegacao nao entra na folha impressa.
        'print:hidden',
      )}
    >
      <Link
        href="/inicio"
        className="flex h-14 shrink-0 items-center px-4"
        aria-label="ColeXa, ir para o início"
      >
        <Logotype className="h-5" label={null} />
      </Link>

      <ul className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {DESTINATIONS.map((destination) => (
          <li key={destination.href}>
            <NavLink destination={destination} current={destination.href === active?.href} />
          </li>
        ))}
      </ul>

      <div className="border-t border-border p-2">
        <NavLink destination={ACCOUNT} current={ACCOUNT.href === active?.href} />
      </div>
    </nav>
  )
}

/** A linha de um destino. A mesma na coluna e na gaveta, de propósito. */
export function NavLink({
  destination,
  current,
  onNavigate,
}: {
  destination: { href: string; label: string; icon: React.ElementType }
  current: boolean
  onNavigate?: () => void
}) {
  const Icon = destination.icon

  return (
    <Link
      href={destination.href}
      aria-current={current ? 'page' : undefined}
      onClick={onNavigate}
      className={cn(
        'flex h-11 items-center gap-3 rounded-control px-3 transition-colors',
        current
          ? 'bg-accent-soft font-semibold text-accent-ink'
          : 'text-text-muted hover:bg-surface-muted hover:text-text',
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      <span className="truncate text-sm">{destination.label}</span>
    </Link>
  )
}
