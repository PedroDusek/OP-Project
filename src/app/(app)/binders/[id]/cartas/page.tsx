import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LocationHeader } from '@/components/storage/location-header'
import { StoredCards } from '@/components/storage/stored-cards'
import {
  getStorageLocation,
  listCardsInLocation,
  listStorageLocations,
} from '@/server/application/storage'
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

  const [location, cards, locations] = await Promise.all([
    getStorageLocation(viewer, BigInt(id)),
    listCardsInLocation(viewer, BigInt(id)),
    listStorageLocations(viewer),
  ])
  if (!location) notFound()

  return (
    <>
      {/* O mesmo cabecalho do detalhe: a pessoa continua "dentro" do binder. */}
      <LocationHeader location={location} view="cartas" />

      <StoredCards
        cards={cards}
        storageLocationId={location.id}
        locationName={location.name}
        locations={locations}
      />
    </>
  )
}
