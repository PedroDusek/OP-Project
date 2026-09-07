import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/app-shell'
import { SetList } from '@/components/catalog/set-list'
import { listSets } from '@/server/application/catalog'

export const metadata: Metadata = { title: 'Sets' }

/**
 * Lista de sets (tela 10).
 *
 * São 60, e a ordenação é a natural do código — não a alfabética, que colocaria
 * `OP-07` antes de `OP01` porque a fonte não é uniforme na grafia. A regra está
 * em `src/server/domain/catalog/sets.ts`.
 *
 * A tela de referência mostra uma barra de progresso por set. Progresso é
 * métrica de **coleção** (`business-rules.md` 2.2), e a coleção chega no próximo
 * checkpoint; até lá, a barra mostraria zero em tudo, que informa menos que não
 * mostrar nada. O componente `ProgressBar` já existe esperando o número.
 */
export default async function SetsPage() {
  const sets = await listSets()

  return (
    <>
      <PageHeader
        title="Sets"
        description={`${sets.length} coletâneas no catálogo.`}
      />
      <SetList sets={sets} />
    </>
  )
}
