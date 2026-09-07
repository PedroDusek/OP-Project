import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/app-shell'
import { LocationForm } from '@/components/storage/location-form'
import { Button } from '@/components/ui/button'
import { getStorageLocation, imageUploadAvailable } from '@/server/application/storage'
import { requireViewer } from '@/server/http/viewer'
import { updateLocationAction } from '../../actions'

export const metadata: Metadata = { title: 'Editar local' }

/** Editar informações, a partir da tela 22. */
export default async function EditarLocalPage({
  params,
}: PageProps<'/binders/[id]/editar'>) {
  const { id } = await params
  const viewer = await requireViewer(`/binders/${id}/editar`)

  if (!/^\d+$/.test(id)) notFound()
  const location = await getStorageLocation(viewer, BigInt(id))
  if (!location) notFound()

  return (
    <>
      <PageHeader
        title="Editar local"
        description={location.name}
        action={
          <Button asChild variant="ghost">
            <Link href={`/binders/${location.id}`}>Cancelar</Link>
          </Button>
        }
      />
      <LocationForm
        action={updateLocationAction}
        submitLabel="Salvar"
        imageUploadAvailable={imageUploadAvailable()}
        initial={{
          id: location.id,
          name: location.name,
          description: location.description ?? '',
          type: location.type,
          purpose: location.purpose,
          image: location.image,
        }}
      />
    </>
  )
}
