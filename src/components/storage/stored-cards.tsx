'use client'

import { useMemo, useState } from 'react'
import { CardArt } from '@/components/catalog/card-art'
import { CardGrid, CardTile } from '@/components/catalog/card-tile'
import { SearchBar } from '@/components/ui/search-bar'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState } from '@/components/ui/states'
import { ListRow, PanelList } from '@/components/ui/surface'
import type { StoredCardView } from '@/server/application/storage'
import { AllocationSheet } from './allocation-sheet'

/**
 * As cartas guardadas num local (tela 23).
 *
 * Tocar numa carta ajusta **quantas estão aqui**, e não quantas se possui: numa
 * lista do conteúdo de um binder, a pergunta seguinte é sempre sobre o binder.
 *
 * A busca filtra no cliente. As cartas já vieram todas — um local tem centenas,
 * não milhares — e uma ida ao servidor a cada tecla seria mais lenta que o
 * próprio filtro.
 *
 * Grid e lista existem porque servem a coisas diferentes: a grade reconhece pela
 * arte, a lista lê códigos em sequência, que é o que se faz ao conferir um
 * binder carta a carta.
 */

type Layout = 'grid' | 'list'

export interface StoredCardsProps {
  cards: StoredCardView[]
  storageLocationId: string
  locationName: string
}

export function StoredCards({ cards, storageLocationId, locationName }: StoredCardsProps) {
  const [layout, setLayout] = useState<Layout>('grid')
  const [term, setTerm] = useState('')
  const [editing, setEditing] = useState<StoredCardView | null>(null)

  const shown = useMemo(() => {
    const needle = term.trim().toLowerCase()
    if (!needle) return cards
    return cards.filter(
      (card) =>
        card.cardCode.toLowerCase().includes(needle) ||
        card.cardName.toLowerCase().includes(needle),
    )
  }, [cards, term])

  return (
    <div className="flex flex-col gap-4">
      <SearchBar
        label="Buscar neste local"
        value={term}
        onValueChange={setTerm}
        placeholder="Buscar por código ou nome..."
      />

      <Segmented
        label="Modo de exibição"
        value={layout}
        onValueChange={setLayout}
        options={[
          { value: 'grid' as const, label: 'Grid' },
          { value: 'list' as const, label: 'Lista' },
        ]}
      />

      {shown.length === 0 ? (
        <EmptyState
          title={cards.length === 0 ? 'Nada guardado aqui' : 'Nada nesta busca'}
          description={
            cards.length === 0
              ? 'Abra uma carta da sua coleção e diga em qual local ela está.'
              : 'Tente outro código ou nome.'
          }
          action={cards.length === 0 ? { label: 'Abrir a coleção', href: '/colecao' } : undefined}
        />
      ) : layout === 'grid' ? (
        <CardGrid>
          {shown.map((card, index) => (
            <CardTile
              key={card.variantId}
              code={card.cardCode}
              name={card.cardName}
              imageUrl={card.imageUrl}
              quantity={card.quantity}
              labels={labelsFor(card)}
              onClick={() => setEditing(card)}
              priority={index < 3}
            />
          ))}
        </CardGrid>
      ) : (
        <PanelList>
          {shown.map((card) => (
            <ListRow
              key={card.variantId}
              leading={
                <CardArt
                  src={card.imageUrl}
                  alt=""
                  fallback={card.cardCode}
                  sizes="44px"
                  className="w-11 rounded-md"
                />
              }
              title={card.cardCode}
              description={card.cardName}
              trailing={
                <span className="text-sm font-semibold text-text tabular-nums">
                  {card.quantity}
                  <span className="text-text-subtle">/{card.ownedQuantity}</span>
                </span>
              }
              onClick={() => setEditing(card)}
              hideChevron
            />
          ))}
        </PanelList>
      )}

      {editing ? (
        /*
         * As copias em **outros** locais nao estao nesta tela, entao o teto
         * seguro e o que a pessoa possui: o servidor recusa o que passar disso,
         * com a conta exata. Oferecer mais do que ela tem seria oferecer um erro.
         */
        <AllocationSheet
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          variantId={editing.variantId}
          code={editing.cardCode}
          name={editing.cardName}
          imageUrl={editing.imageUrl}
          storageLocationId={storageLocationId}
          locationName={locationName}
          currentQuantity={editing.quantity}
          max={editing.ownedQuantity}
        />
      ) : null}
    </div>
  )
}

function labelsFor(card: StoredCardView): string[] {
  const labels: string[] = []
  if (card.rarity) labels.push(card.rarity)
  if (card.variantType !== 'Normal') labels.push(card.variantType)
  if (card.playsetHere) labels.push('Playset')
  return labels
}
