import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/app-shell'
import { LocationForm } from '@/components/storage/location-form'
import { imageUploadAvailable } from '@/server/application/storage'
import { requireViewer } from '@/server/http/viewer'
import { createLocationAction } from '../actions'

export const metadata: Metadata = { title: 'Novo local' }

/** Criar storage (tela 24). */
export default async function NovoLocalPage() {
  await requireViewer('/armazenamento/novo')

  return (
    <>
      <PageHeader
        title="Novo local"
        description="Um binder, uma caixa ou um deck para organizar suas cartas."
      />
      <LocationForm
        action={createLocationAction}
        submitLabel="Criar local"
        imageUploadAvailable={imageUploadAvailable()}
      />
    </>
  )
}
