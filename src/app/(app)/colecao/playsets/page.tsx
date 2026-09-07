import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/app-shell'
import { PlaysetList } from '@/components/collection/playset-list'
import { EmptyState } from '@/components/ui/states'
import { listPlaysets } from '@/server/application/collection'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Playsets' }

/**
 * Playsets (tela 19).
 *
 * Lista **cartas**, e não variantes: é a carta que fecha ou não fecha um
 * playset, somando todas as artes (`business-rules.md` 2.1). `Leader` fica de
 * fora inteiro, porque nunca conta.
 */
export default async function PlaysetsPage() {
  const viewer = await requireViewer('/colecao/playsets')
  const rows = await listPlaysets(viewer)

  const fechados = rows.filter((row) => row.closed).length

  return (
    <>
      <PageHeader
        title="Playsets"
        description={
          rows.length === 0
            ? 'Cartas com 4 ou mais cópias.'
            : `${fechados} de ${rows.length} cartas com 4 ou mais cópias.`
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Nenhuma carta ainda"
          description="Playset conta por código de carta, somando todas as artes. Líderes não contam."
          action={{ label: 'Ver minha coleção', href: '/colecao' }}
        />
      ) : (
        <PlaysetList rows={rows} />
      )}
    </>
  )
}
