import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/app-shell'
import { SetList } from '@/components/catalog/set-list'
import { listSets } from '@/server/application/catalog'
import type { SetKind } from '@/server/domain/catalog/sets'

export const metadata: Metadata = { title: 'Sets' }

const KINDS: SetKind[] = ['collection', 'deck', 'promo']

/**
 * Lista de sets (tela 10).
 *
 * Coleções e decks ficam separados, a pedido do dono do produto: são coisas
 * diferentes de procurar, e 36 decks iniciantes no meio das coletâneas atrapalham
 * quem quer saber o que falta de um booster.
 *
 * As coleções aparecem **em ordem de lançamento** — a que o dono do produto
 * informou, e a única em que os extra boosters caem no lugar certo entre os
 * boosters. Ver a decisão 036.
 *
 * A tela de referência mostra uma barra de progresso por set. Progresso é
 * métrica de **coleção** (`business-rules.md` 2.2), e a coleção chega no próximo
 * checkpoint; até lá, a barra mostraria zero em tudo, que informa menos que não
 * mostrar nada. O componente `ProgressBar` já existe esperando o número.
 */
export default async function SetsPage({ searchParams }: PageProps<'/catalogo/sets'>) {
  const params = await searchParams
  const requested = Array.isArray(params.tipo) ? params.tipo[0] : params.tipo
  const initialKind = KINDS.includes(requested as SetKind) ? (requested as SetKind) : 'collection'

  const sets = await listSets()

  return (
    <>
      <PageHeader
        title="Sets"
        description={`${sets.length} coletâneas e decks no catálogo.`}
      />
      <SetList sets={sets} initialKind={initialKind} />
    </>
  )
}
