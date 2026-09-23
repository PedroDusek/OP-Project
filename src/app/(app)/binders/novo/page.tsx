import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/app-shell'
import { LocationForm } from '@/components/storage/location-form'
import { imageUploadAvailable } from '@/server/application/storage'
import { requireViewer } from '@/server/http/viewer'
import { createLocationAction } from '../actions'

export const metadata: Metadata = { title: 'Novo local' }

/** Criar storage (tela 24). */
export default async function NovoLocalPage() {
  await requireViewer('/binders/novo')

  return (
    <>
      <PageHeader back={{ href: '/binders', label: 'Binders' }}
        title="Novo local"
        description="Um binder ou uma caixa para organizar suas cartas."
      />
      {/* A deckbox se cria em Decks desde a decisão 111. */}
      <LocationForm
        action={createLocationAction}
        submitLabel="Criar local"
        imageUploadAvailable={imageUploadAvailable()}
        types={['BINDER', 'BOX']}
      />
    </>
  )
}
