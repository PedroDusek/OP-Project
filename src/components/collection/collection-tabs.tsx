'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'

/**
 * "Tenho" e "Quero", as duas faces da coleção.
 *
 * A want list é a coleção pelo avesso — o que falta —, e por isso mora aqui em
 * vez de dentro de Trocas: quem abre a lista de desejos está pensando na
 * própria coleção, não em negociar. Foi a escolha do dono do produto, e ela não
 * custa vaga na barra de navegação, que já está cheia.
 *
 * São **links**, e não botões: cada face é uma rota própria, compartilhável, e
 * que funciona antes de o JavaScript subir. `aria-current` marca a atual, que é
 * o que um leitor de tela anuncia.
 */

const TABS = [
  { href: '/colecao', label: 'Tenho' },
  { href: '/colecao/quero', label: 'Quero' },
] as const

export function CollectionTabs({ counts }: { counts?: Partial<Record<string, number>> }) {
  const pathname = usePathname()

  return (
    <div role="tablist" aria-label="Coleção" className="flex gap-2">
      {TABS.map((tab) => {
        const current = pathname === tab.href
        const count = counts?.[tab.href]

        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={current}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5',
              'text-sm font-medium whitespace-nowrap transition-colors',
              current
                ? 'border-accent-ink/30 bg-accent-soft text-accent-ink'
                : 'border-border bg-surface text-text-muted hover:bg-surface-muted',
            )}
          >
            {tab.label}
            {count !== undefined ? (
              <span className={current ? 'text-accent-ink/80' : 'text-text-subtle'}>({count})</span>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}
