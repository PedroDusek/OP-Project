import { AppShell } from '@/components/layout/app-shell'

/**
 * Layout das areas principais: as cinco secoes da navegacao.
 *
 * A sessao ainda nao e resolvida aqui — ver o comentario em `top-bar.tsx`.
 * Quando as telas de entrada existirem, e neste arquivo que o `viewer` passa a
 * vir da sessao, e em nenhum outro lugar.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
