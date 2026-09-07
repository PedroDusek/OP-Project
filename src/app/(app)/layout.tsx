import { headers } from 'next/headers'
import { AppShell } from '@/components/layout/app-shell'
import { requireViewer } from '@/server/http/viewer'

/**
 * Layout das areas principais: as cinco secoes da navegacao.
 *
 * Exige sessao. O redirecionamento leva junto o caminho pedido, para quem abre
 * um link direto da coleção voltar exatamente ali depois de entrar, em vez de
 * cair no início e ter que navegar de novo.
 *
 * Isto e conveniencia de navegacao, e nao a protecao. A protecao real esta no
 * caso de uso, que confere a propriedade do recurso contra o usuario da sessao
 * (`architecture.md` 3.5) — e continuaria valendo mesmo que este layout
 * sumisse.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // O Next expoe o caminho atual ao layout por cabecalho; sem ele, o `next` do
  // redirecionamento sempre apontaria para o inicio.
  const pathname = (await headers()).get('x-pathname') ?? '/inicio'
  const viewer = await requireViewer(pathname)

  return (
    <AppShell viewer={{ name: viewer.name, premium: viewer.plan === 'PREMIUM' }}>
      {children}
    </AppShell>
  )
}
