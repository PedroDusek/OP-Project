'use client'

import { useState } from 'react'
import { Archive, Package } from 'lucide-react'
import { ListRow, PanelList } from '@/components/ui/surface'
import { EmptyState } from '@/components/ui/states'
import type { AllocationView, VariantAllocations } from '@/server/application/storage'
import { AllocationSheet } from './allocation-sheet'

/**
 * Onde as cópias desta carta estão guardadas (a partir da tela 15).
 *
 * Lista **todos** os locais da pessoa, inclusive os vazios, porque a tela é de
 * escolha: uma lista só com o que já foi guardado não deixaria guardar em lugar
 * novo — e guardar pela primeira vez é o caso mais comum aqui.
 *
 * A linha de cópias sem lugar não é um local. Não existe local "sem lugar"
 * (`business-rules.md` 3.2): é o resto da conta, e aparece como texto para a
 * soma fechar na cabeça de quem olha.
 */
export function VariantAllocationsPanel({
  variantId,
  code,
  name,
  imageUrl,
  allocations,
}: {
  variantId: string
  code: string
  name: string
  imageUrl: string | null
  allocations: VariantAllocations
}) {
  const [editing, setEditing] = useState<AllocationView | null>(null)

  if (allocations.ownedQuantity === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-text">Onde está guardada</h2>

      {allocations.locations.length === 0 ? (
        <EmptyState
          icon={<Archive className="size-8" aria-hidden />}
          title="Nenhum local ainda"
          description="Binder, caixa e deck se criam na aba Binders. Depois, esta carta pode entrar em qualquer um deles."
          action={{ label: 'Criar em Binders', href: '/binders/novo' }}
        />
      ) : (
        <>
          <PanelList>
            {allocations.locations.map((location) => (
              <ListRow
                key={location.storageLocationId}
                leading={<Package className="size-5 text-text-muted" aria-hidden />}
                title={location.name}
                description={location.subtitle}
                trailing={
                  <span className="text-sm font-semibold text-text tabular-nums">
                    {location.quantity}
                  </span>
                }
                onClick={() => setEditing(location)}
                hideChevron
              />
            ))}
          </PanelList>

          <p className="text-xs text-text-muted tabular-nums">
            {allocations.unallocated === 0
              ? 'Todas as suas cópias têm lugar registrado.'
              : `${allocations.unallocated} de ${allocations.ownedQuantity} sem lugar registrado.`}
          </p>
        </>
      )}

      {editing ? (
        <AllocationSheet
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          variantId={variantId}
          code={code}
          name={name}
          imageUrl={imageUrl}
          storageLocationId={editing.storageLocationId}
          locationName={editing.name}
          locationSubtitle={editing.subtitle}
          currentQuantity={editing.quantity}
          // O que cabe aqui é o que se possui menos o que está nos outros.
          max={allocations.ownedQuantity - (allocations.allocated - editing.quantity)}
        />
      ) : null}
    </section>
  )
}
