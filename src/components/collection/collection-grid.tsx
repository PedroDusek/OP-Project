'use client'

import { useState } from 'react'
import { CardGrid, CardTile } from '@/components/catalog/card-tile'
import { QuantitySheet } from './quantity-sheet'

/**
 * A grade da coleção (tela 17).
 *
 * Diferente da grade do catálogo em uma coisa: tocar numa carta abre a edição de
 * quantidade em vez de navegar para o detalhe. Numa lista do que se tem, a
 * pergunta seguinte quase sempre é "quantas", e obrigar a passar pelo detalhe
 * transformaria um ajuste de um toque em três.
 *
 * A quantidade aparece no canto de cada carta, e o playset fechado ganha
 * moldura — a mesma informação que a aba "Playsets" filtra.
 */

export interface CollectionCardView {
  variantId: string
  cardCode: string
  cardName: string
  rarity: string | null
  variantType: string
  imageUrl: string | null
  quantity: number
  quantityForCard: number
  playsetClosed: boolean
}

export function CollectionGrid({ items }: { items: CollectionCardView[] }) {
  const [editing, setEditing] = useState<CollectionCardView | null>(null)

  return (
    <>
      <CardGrid>
        {items.map((item, index) => (
          <CardTile
            key={item.variantId}
            code={item.cardCode}
            name={item.cardName}
            imageUrl={item.imageUrl}
            quantity={item.quantity}
            labels={labelsFor(item)}
            onClick={() => setEditing(item)}
            priority={index < 3}
          />
        ))}
      </CardGrid>

      {editing ? (
        <QuantitySheet
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          variantId={editing.variantId}
          code={editing.cardCode}
          name={editing.cardName}
          imageUrl={editing.imageUrl}
          labels={labelsFor(editing)}
          currentQuantity={editing.quantity}
        />
      ) : null}
    </>
  )
}

/**
 * Raridade sempre; variante só quando não é Normal; playset quando fechou.
 *
 * "Normal" em toda carta é ruído — é o caso comum. "Playset" só aparece onde
 * significa algo.
 */
function labelsFor(item: CollectionCardView): string[] {
  const labels: string[] = []
  if (item.rarity) labels.push(item.rarity)
  if (item.variantType !== 'Normal') labels.push(item.variantType)
  if (item.playsetClosed) labels.push('Playset')
  return labels
}
