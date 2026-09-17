import type { Metadata } from 'next'
import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { Logotype } from '@/components/brand/logo'

export const metadata: Metadata = { title: 'Página não encontrada', robots: { index: false } }

/**
 * Endereço que não existe (decisão 092).
 *
 * Antes era a página padrão do Next, em inglês e sem caminho de volta. Sem o
 * shell do app: quem cai aqui pode nem ter sessão.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <Logotype className="h-6 w-auto" />
      <SearchX className="size-10 text-text-subtle" aria-hidden />
      <div className="flex max-w-sm flex-col gap-1">
        <h1 className="text-lg font-semibold text-text">Não encontramos esta página</h1>
        <p className="text-sm text-text-muted">
          O endereço pode estar errado, ou o que ele mostrava não existe mais — um link de troca
          encerrada, por exemplo.
        </p>
      </div>
      <Link
        href="/inicio"
        className="inline-flex h-11 items-center rounded-control border border-border px-4 text-sm font-medium text-text hover:bg-surface-muted"
      >
        Ir para o início
      </Link>
    </main>
  )
}
