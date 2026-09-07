import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Layers, SquarePen, Star } from 'lucide-react'
import { DeleteLocation } from '@/components/storage/delete-location'
import { LocationHeader } from '@/components/storage/location-header'
import { StatTile } from '@/components/collection/stat-tile'
import { ListRow, Panel, PanelList } from '@/components/ui/surface'
import { getStorageLocation } from '@/server/application/storage'
import { STORAGE_PURPOSE_LABEL, STORAGE_TYPE_LABEL } from '@/server/domain/storage/locations'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Local' }

/**
 * Detalhe do storage (tela 22).
 *
 * ## O valor estimado não está aqui
 *
 * A tela de referência mostra "R$ 3.420 valor estimado". O modelo tem
 * `card_prices` desde o Checkpoint 2, mas **nenhuma linha**: não existe fonte de
 * preço definida nem importação escrita. Mostrar um número inventado num campo
 * de dinheiro seria pior que não mostrar nada, e mostrar "R$ 0,00" seria mentira
 * com aparência de verdade. O espaço volta quando o preço tiver origem.
 */
export default async function LocalPage({ params }: PageProps<'/armazenamento/[id]'>) {
  const { id } = await params
  const viewer = await requireViewer(`/armazenamento/${id}`)

  if (!/^\d+$/.test(id)) notFound()
  const location = await getStorageLocation(viewer, BigInt(id))
  if (!location) notFound()

  return (
    <>
      <LocationHeader location={location} />

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            value={String(location.cardCount)}
            label={location.cardCount === 1 ? 'carta' : 'cartas'}
            icon={<Layers className="size-4" aria-hidden />}
          />
          <StatTile
            value={String(location.closedPlaysetsHere)}
            label={location.closedPlaysetsHere === 1 ? 'playset aqui' : 'playsets aqui'}
            icon={<Star className="size-4" aria-hidden />}
          />
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-text">Informações</h2>
          <Panel className="flex flex-col gap-3 p-4">
            <Info label="Tipo" value={STORAGE_TYPE_LABEL[location.type]} />
            <Info
              label="Finalidade"
              value={
                location.purpose ? STORAGE_PURPOSE_LABEL[location.purpose] : 'Não se aplica a decks'
              }
            />
            {location.description ? (
              <Info label="Descrição" value={location.description} />
            ) : null}
            <Info label="Criado em" value={formatDate(location.createdAt)} />
            <Info label="Última edição" value={formatDate(location.updatedAt)} />
          </Panel>
        </section>

        <PanelList>
          <ListRow
            href={`/armazenamento/${location.id}/cartas`}
            leading={<Layers className="size-5 text-text-muted" aria-hidden />}
            title="Ver cartas"
            description={
              location.cardCount === 0
                ? 'Nenhuma carta guardada aqui ainda.'
                : `${location.uniqueVariants} variantes guardadas.`
            }
          />
          <ListRow
            href={`/armazenamento/${location.id}/editar`}
            leading={<SquarePen className="size-5 text-text-muted" aria-hidden />}
            title="Editar informações"
          />
          <DeleteLocation id={location.id} name={location.name} />
        </PanelList>
      </div>
    </>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-sm text-text-muted">{label}</span>
      <span className="text-right text-sm text-text">{value}</span>
    </div>
  )
}

/**
 * Data em português, no fuso de São Paulo.
 *
 * O fuso é fixo e não o do navegador porque isto renderiza no servidor: sem
 * fixar, a data trocaria entre a versão em cache e a recém-gerada.
 */
function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(value)
}
