import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Flag } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { EmptyState } from '@/components/ui/states'
import { Panel } from '@/components/ui/surface'
import { listReports } from '@/server/application/social'
import { NotFoundError } from '@/server/domain/errors'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Denúncias', robots: { index: false, follow: false } }

/**
 * As denúncias da rede, para quem administra (regra 6.1.4, decisão 079).
 *
 * Só leitura: o que se faz com elas é processo, e não produto. Quem não
 * administra recebe a página de não encontrado — a recusa está no caso de uso,
 * e aqui só se traduz.
 */
export default async function DenunciasPage() {
  const viewer = await requireViewer('/admin/denuncias')

  let denuncias
  try {
    denuncias = await listReports(viewer)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }

  return (
    <>
      <PageHeader title="Denúncias" description="As mais recentes primeiro. O e-mail só aparece aqui, para quem administra." />

      {denuncias.length === 0 ? (
        <EmptyState icon={<Flag className="size-10" aria-hidden />} title="Nenhuma denúncia" />
      ) : (
        <ul className="flex flex-col gap-3">
          {denuncias.map((denuncia) => (
            <li key={denuncia.id}>
              <Panel className="flex flex-col gap-2 p-4">
                <p className="text-sm text-text">
                  <strong>{pessoa(denuncia.reporter)}</strong> denunciou <strong>{pessoa(denuncia.reported)}</strong>
                </p>
                <p className="text-xs text-text-subtle tabular-nums">
                  {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(denuncia.createdAt)}
                </p>
                <p className="text-sm whitespace-pre-wrap text-text">{denuncia.reason}</p>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function pessoa(quem: { username: string | null; email: string }): string {
  return quem.username ? `@${quem.username} (${quem.email})` : quem.email
}
