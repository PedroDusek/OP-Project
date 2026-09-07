'use client'

import { useMemo, useState } from 'react'
import { ListRow, PanelList } from '@/components/ui/surface'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState } from '@/components/ui/states'
import { STORAGE_TYPES, STORAGE_TYPE_PLURAL, type StorageType } from '@/server/domain/storage/locations'
import { cardCountLabel } from '@/server/domain/catalog/sets'
import type { StorageLocationSummary } from '@/server/application/storage'
import { LocationArt } from './location-art'

/**
 * A lista de locais (tela 21).
 *
 * O recorte por tipo filtra no cliente, e não por parâmetro na URL. A diferença
 * é de escala: são poucos locais, todos já vieram, e uma ida ao servidor para
 * esconder três linhas seria mais lenta que a resposta ao toque.
 *
 * As abas mostram a contagem mesmo quando é zero — "Decks (0)" ensina que a
 * gaveta existe e está vazia, enquanto uma aba ausente parece um recurso que
 * não existe.
 */

type Scope = 'ALL' | StorageType

export function LocationList({ locations }: { locations: StorageLocationSummary[] }) {
  const [scope, setScope] = useState<Scope>('ALL')

  const counts = useMemo(() => {
    const byType = Object.fromEntries(
      STORAGE_TYPES.map((type) => [type, locations.filter((l) => l.type === type).length]),
    ) as Record<StorageType, number>
    return { ALL: locations.length, ...byType }
  }, [locations])

  const shown = scope === 'ALL' ? locations : locations.filter((l) => l.type === scope)

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Tipo de local"
        value={scope}
        onValueChange={setScope}
        options={[
          { value: 'ALL' as const, label: 'Todos', count: counts.ALL },
          ...STORAGE_TYPES.map((type) => ({
            value: type,
            label: STORAGE_TYPE_PLURAL[type],
            count: counts[type],
          })),
        ]}
      />

      {shown.length === 0 ? (
        <EmptyState
          title="Nada neste recorte"
          description="Escolha outra aba ou crie um local deste tipo."
        />
      ) : (
        <PanelList>
          {shown.map((location) => (
            <ListRow
              key={location.id}
              href={`/armazenamento/${location.id}`}
              leading={<LocationArt image={location.image} type={location.type} />}
              title={location.name}
              description={location.subtitle}
              trailing={
                <span className="text-xs text-text-subtle tabular-nums">
                  {cardCountLabel(location.cardCount)}
                </span>
              }
            />
          ))}
        </PanelList>
      )}
    </div>
  )
}
