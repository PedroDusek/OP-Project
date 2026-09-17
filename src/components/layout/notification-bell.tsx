'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, PackageOpen } from 'lucide-react'
import { Popover } from 'radix-ui'
import { cn } from '@/lib/cn'
import type { Notice } from '@/server/application/notifications'

/**
 * O sino: os avisos pendentes, e o pontinho enquanto houver algum (decisão 080).
 *
 * ## Pergunta, e não recebe
 *
 * O layout não é refeito ao navegar, então o sino busca os avisos sozinho: ao
 * abrir cada página, ao voltar para a aba e a cada minuto com a aba à vista. Um
 * minuto é o atraso de quem guardou as cartas noutra aba; ao navegar, o aviso já
 * vem certo.
 *
 * ## Estado atual
 *
 * Os avisos somem sozinhos quando a pessoa resolve o assunto. Não há "marcar
 * como lida": abrir o sino não apaga nada, e o pontinho some quando o que ele
 * aponta deixa de ser verdade.
 */

const INTERVALO_MS = 60_000

/** Os avisos de agora, ou `null` quando não deu para saber — aí o sino mantém o que mostrava. */
async function carregarAvisos(): Promise<Notice[] | null> {
  try {
    const resposta = await fetch('/api/me/notificacoes', { cache: 'no-store' })
    if (!resposta.ok) return null
    return ((await resposta.json()) as { notices: Notice[] }).notices
  } catch {
    return null
  }
}

export function NotificationBell({ initial = [] }: { initial?: Notice[] }) {
  const pathname = usePathname()
  const [notices, setNotices] = useState<Notice[]>(initial)
  const [aberto, setAberto] = useState(false)

  // A cada pagina aberta, ao voltar para a aba e a cada minuto com a aba a vista.
  // Guardar as cartas e navegar ja apaga o aviso.
  useEffect(() => {
    let vivo = true
    const atualizar = () => {
      void carregarAvisos().then((avisos) => {
        if (vivo && avisos) setNotices(avisos)
      })
    }

    atualizar()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') atualizar()
    }, INTERVALO_MS)
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') atualizar()
    }
    document.addEventListener('visibilitychange', aoVoltar)

    return () => {
      vivo = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [pathname])

  const pendentes = notices.length > 0

  return (
    <Popover.Root open={aberto} onOpenChange={setAberto}>
      <Popover.Trigger
        aria-label={pendentes ? `Notificações, ${notices.length} ${notices.length === 1 ? 'pendente' : 'pendentes'}` : 'Notificações'}
        className="relative inline-flex size-11 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
      >
        <Bell className="size-5" aria-hidden />
        {pendentes ? (
          <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-danger ring-2 ring-surface" aria-hidden />
        ) : null}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          collisionPadding={8}
          className="z-40 w-[min(22rem,calc(100vw-1rem))] rounded-card border border-border bg-surface p-2 shadow-raised outline-none"
        >
          <p className="px-2 pt-1 pb-2 text-sm font-semibold text-text">Notificações</p>
          {pendentes ? (
            <ul className="flex flex-col gap-1">
              {notices.map((notice) => (
                <li key={notice.kind}>
                  <Aviso notice={notice} onNavigate={() => setAberto(false)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 pb-3 text-sm text-text-muted">Nada pendente por aqui.</p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function Aviso({ notice, onNavigate }: { notice: Notice; onNavigate: () => void }) {
  switch (notice.kind) {
    case 'unallocated-cards':
      return (
        <Item
          href="/binders/sem-lugar"
          icon={<PackageOpen className="size-5" aria-hidden />}
          title={`Você tem ${notice.copies} ${notice.copies === 1 ? 'cópia' : 'cópias'} sem armazenamento`}
          description={`${notice.cards} ${notice.cards === 1 ? 'carta esperando' : 'cartas esperando'} um binder, caixa ou deck.`}
          onNavigate={onNavigate}
        />
      )
  }
}

function Item({
  href,
  icon,
  title,
  description,
  onNavigate,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
  onNavigate: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn('flex items-start gap-3 rounded-control px-2 py-2 transition-colors hover:bg-surface-muted')}
    >
      <span className="mt-0.5 shrink-0 text-accent-ink">{icon}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-text tabular-nums">{title}</span>
        <span className="text-xs text-text-muted tabular-nums">{description}</span>
      </span>
    </Link>
  )
}
