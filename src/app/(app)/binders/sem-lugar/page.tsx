import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PlaceCards } from '@/components/storage/place-cards'
import { EmptyState } from '@/components/ui/states'
import { listStorageLocations, listUnallocated } from '@/server/application/storage'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Cartas sem lugar' }

/**
 * Organizar o que ainda não tem lugar.
 *
 * É a direção que faltava em Binders. O detalhe da carta responde "onde esta
 * carta está" — uma carta, vários locais. Aqui é a pergunta de quem está
 * organizando: "o que ainda não guardei", várias cartas, um local por vez.
 *
 * Sem nenhum local criado, esta tela não teria para onde apontar: o convite
 * seria um beco. Nesse caso ela manda criar o primeiro.
 */
export default async function SemLugarPage() {
  const viewer = await requireViewer('/binders/sem-lugar')

  const [cards, locations] = await Promise.all([
    listUnallocated(viewer),
    listStorageLocations(viewer),
  ])

  return (
    <>
      <div className="flex items-start gap-3 pb-4">
        <Link
          href="/binders"
          aria-label="Voltar para Binders"
          className="-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-muted"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1 pt-2">
          <h1 className="truncate text-2xl font-bold tracking-tight text-text">
            Cartas sem lugar
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Cópias que você tem e ainda não disse onde estão.
          </p>
        </div>
      </div>

      {locations.length === 0 ? (
        <EmptyState
          title="Você ainda não tem onde guardar"
          description="Crie um binder, uma caixa ou um deck. Depois volte aqui para dizer o que vai em cada um."
          action={{ label: 'Criar o primeiro local', href: '/binders/novo' }}
        />
      ) : (
        <PlaceCards cards={cards} locations={locations} />
      )}
    </>
  )
}
