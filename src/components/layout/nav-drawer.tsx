'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { ACCOUNT, DESTINATIONS, activeDestination } from './navigation'
import { NavLink } from './side-nav'

/**
 * A navegação do celular, numa gaveta.
 *
 * ## Por que deixou de ser barra
 *
 * A barra inferior tinha cinco lugares, e o teto era dela: seis alvos a 360 px
 * dão 60 px cada, abaixo do confortável para o polegar. Numa gaveta cada linha
 * tem a altura inteira de uma lista, e cabem quantas forem precisas — foi o que
 * destravou pôr Want list, Trocas e Social na navegação (decisão 061).
 *
 * ## Por que ela sobe de baixo, e não entra pela esquerda
 *
 * A gaveta lateral é o gesto do desktop, onde o ponteiro alcança qualquer canto
 * sem custo. No celular a mão segura o aparelho por baixo, e um painel que
 * nasce embaixo cai onde o polegar já está.
 *
 * É também o mesmo objeto que o produto já usa para filtros e para editar
 * quantidade: uma gaveta nova só para navegar ensinaria um segundo gesto para
 * dizer a mesma coisa.
 *
 * ## Fecha ao navegar
 *
 * Sem isso ela ficaria aberta sobre a tela nova, e a pessoa teria de fechar o
 * menu que acabou de usar.
 */
export function NavDrawer() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const active = activeDestination(pathname)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir o menu"
        aria-expanded={open}
        className="inline-flex size-11 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-muted hover:text-text md:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <Sheet open={open} onOpenChange={setOpen} title="Navegação" hideTitle>
        <nav aria-label="Navegação principal">
          <ul className="flex flex-col gap-1">
            {DESTINATIONS.map((destination) => (
              <li key={destination.href}>
                <NavLink
                  destination={destination}
                  current={destination.href === active?.href}
                  onNavigate={() => setOpen(false)}
                />
              </li>
            ))}
          </ul>

          <div className="mt-2 border-t border-border pt-2">
            <NavLink
              destination={ACCOUNT}
              current={ACCOUNT.href === active?.href}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </nav>
      </Sheet>
    </>
  )
}
