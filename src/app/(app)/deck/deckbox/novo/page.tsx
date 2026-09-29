import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/app-shell'
import { LocationForm } from '@/components/storage/location-form'
import { imageUploadAvailable } from '@/server/application/storage'
import { requireViewer } from '@/server/http/viewer'
import { createLocationAction } from '../../../binders/actions'

export const metadata: Metadata = { title: 'Nova deckbox' }

/**
 * Criar uma deckbox (decisão 111).
 *
 * A ação é a **mesma** de Binders, e de propósito: uma deckbox é um
 * `storage_location` de tipo `DECK`, e duplicar o caso de uso para mudar de
 * porta de entrada criaria duas regras de criação que divergiriam. O que muda é
 * só o que a tela oferece — aqui o tipo é fixo, e o formulário nem mostra o
 * seletor.
 */
export default async function NovaDeckboxPage() {
  await requireViewer('/deck/deckbox/novo')

  return (
    <>
      <PageHeader
        back={{ href: '/deck', label: 'Decks' }}
        title="Nova deckbox"
        description="A caixa onde um deck montado mora."
      />
      <LocationForm
        action={createLocationAction}
        submitLabel="Criar deckbox"
        imageUploadAvailable={imageUploadAvailable()}
        types={['DECK']}
      />
    </>
  )
}
