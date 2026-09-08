import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { BulkAdd } from '@/components/storage/bulk-add'
import { getCatalogVocabulary } from '@/server/application/catalog'
import { getStorageLocation } from '@/server/application/storage'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Adicionar cartas' }

/**
 * Adicionar cartas em massa a um local (telas 25 a 28).
 *
 * Entra-se por um binder, e não pela coleção: a operação tem um destino, e o
 * destino é este local. Foi onde o dono do produto pediu que ela morasse.
 */
export default async function AdicionarPage({ params }: PageProps<'/binders/[id]/adicionar'>) {
  const { id } = await params
  const viewer = await requireViewer(`/binders/${id}/adicionar`)

  if (!/^\d+$/.test(id)) notFound()

  const [location, vocabulary] = await Promise.all([
    getStorageLocation(viewer, BigInt(id)),
    getCatalogVocabulary(),
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
          <h1 className="truncate text-2xl font-bold tracking-tight text-text">Adicionar cartas</h1>
          <p className="mt-1 text-sm text-text-muted">
            Escolha quantas cópias de cada carta entram em {location.name}.
          </p>
        </div>
      </div>

      <BulkAdd
        storageLocationId={location.id}
        locationName={location.name}
        vocabulary={vocabulary}
      />
    </>
  )
}
