import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { StoredCards } from '@/components/storage/stored-cards'
import { getStorageLocation, listCardsInLocation } from '@/server/application/storage'
import { cardCountLabel } from '@/server/domain/catalog/sets'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Cartas no local' }

/**
 * Cartas no storage (tela 23).
 *
 * A ordem é a mesma do catálogo e da coleção — lançamento, promos no fim
 * (decisão 040) — porque é a ordem que a pessoa já aprendeu nas outras telas.
 */
export default async function CartasNoLocalPage({
  params,
}: PageProps<'/binders/[id]/cartas'>) {
  const { id } = await params
  const viewer = await requireViewer(`/binders/${id}/cartas`)

  if (!/^\d+$/.test(id)) notFound()

  const [location, cards] = await Promise.all([
    getStorageLocation(viewer, BigInt(id)),
    listCardsInLocation(viewer, BigInt(id)),
  ])
  if (!location) notFound()

  return (
    <>
      <div className="flex items-start gap-3 pb-4">
        <Link
          href={`/binders/${location.id}`}
          aria-label={`Voltar para ${location.name}`}
          className="-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-muted"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1 pt-2">
          <h1 className="truncate text-2xl font-bold tracking-tight text-text">{location.name}</h1>
          <p className="mt-1 text-sm text-text-muted">{cardCountLabel(location.cardCount)}</p>
        </div>
      </div>

      <StoredCards cards={cards} storageLocationId={location.id} locationName={location.name} />
    </>
  )
}
