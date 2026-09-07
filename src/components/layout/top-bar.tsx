'use client'

import Link from 'next/link'
import { Bell, CircleUser } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Logotype } from '@/components/brand/logo'
import { Avatar } from '@/components/ui/avatar'

/**
 * Barra superior.
 *
 * O logotipo so aparece no celular: a partir do `md` ele ja esta no topo da
 * coluna lateral, e mostrar duas vezes a mesma marca na mesma tela e ruido.
 *
 * ## Por que a sessao nao e resolvida aqui
 *
 * `viewer` chega como propriedade, e nao de dentro do componente. Este
 * checkpoint entrega a base do frontend, e a sessao no cliente entra com as
 * telas de entrada e autenticacao. Amarrar as duas coisas agora obrigaria o
 * shell a depender de configuracao do provedor so para desenhar um avatar — e
 * uma tela de layout falharia por falta de chave do Supabase.
 *
 * Sem `viewer`, a barra mostra o caminho para entrar. E o estado real de quem
 * ainda nao tem conta, nao um placeholder.
 */

export interface Viewer {
  name: string
  premium?: boolean
}

export interface TopBarProps {
  viewer?: Viewer
  /** Notificacao nao lida: ponto no sino. A contagem vem depois. */
  hasUnread?: boolean
  className?: string
}

export function TopBar({ viewer, hasUnread = false, className }: TopBarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex h-14 items-center gap-2 px-4',
        'border-b border-border bg-surface',
        className,
      )}
    >
      <Link href="/inicio" className="flex items-center md:hidden" aria-label="ColeXa, ir para o início">
        <Logotype className="h-5" label={null} />
      </Link>

      <div className="flex-1" />

      <Link
        href="/mais"
        aria-label={
          hasUnread ? 'Notificações, há mensagens não lidas' : 'Notificações'
        }
        className="relative inline-flex size-11 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
      >
        <Bell className="size-5" aria-hidden />
        {hasUnread ? (
          <span
            className="absolute top-2.5 right-2.5 size-2 rounded-full bg-danger ring-2 ring-surface"
            aria-hidden
          />
        ) : null}
      </Link>

      {viewer ? (
        <Link
          href="/mais"
          aria-label={`Perfil de ${viewer.name}`}
          className="inline-flex size-11 items-center justify-center rounded-control"
        >
          <Avatar name={viewer.name} size="sm" />
        </Link>
      ) : (
        <Link
          href="/mais"
          aria-label="Entrar na sua conta"
          className="inline-flex size-11 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
        >
          <CircleUser className="size-6" aria-hidden />
        </Link>
      )}
    </header>
  )
}
