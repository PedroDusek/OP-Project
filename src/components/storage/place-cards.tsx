'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { PackageOpen } from 'lucide-react'
import { CardArt } from '@/components/catalog/card-art'
import { Button } from '@/components/ui/button'
import { QuantitySelector } from '@/components/ui/quantity-selector'
import { SearchBar } from '@/components/ui/search-bar'
import { Sheet } from '@/components/ui/sheet'
import { EmptyState } from '@/components/ui/states'
import { ListRow, PanelList } from '@/components/ui/surface'
import { useToast } from '@/components/ui/toast'
import { placeCopiesAction } from '@/app/(app)/binders/actions'
import { ALLOCATION_IDLE } from '@/app/(app)/binders/state'
import type { StorageLocationSummary, UnallocatedCard } from '@/server/application/storage'
import { LocationArt } from './location-art'

/**
 * Guardar as cópias que ainda não têm lugar.
 *
 * É a direção que faltava. O detalhe da carta responde "onde esta carta está" —
 * uma carta, vários locais. Aqui a pergunta é a de quem está organizando: "o
 * que ainda não guardei, e em qual binder vai" — várias cartas, um local por
 * vez.
 *
 * ## Um toque por carta
 *
 * O painel abre com **todas** as cópias soltas já escolhidas, porque guardar
 * tudo junto é o caso comum: quem abriu um pacote põe as quatro no mesmo
 * binder. Tocar num local guarda e fecha. Quem quiser dividir mexe no seletor
 * antes — o controle está ali, só não está no caminho.
 *
 * ## Manda quantas acrescentar, não o total
 *
 * O servidor soma dentro do lock. Calcular o total aqui seria calcular a partir
 * de um número lido antes, que é a leitura que o lock existe para invalidar.
 */
export function PlaceCards({
  cards,
  locations,
}: {
  cards: UnallocatedCard[]
  locations: StorageLocationSummary[]
}) {
  const [term, setTerm] = useState('')
  const [placing, setPlacing] = useState<UnallocatedCard | null>(null)

  const shown = useMemo(() => {
    const needle = term.trim().toLowerCase()
    if (!needle) return cards
    return cards.filter(
      (card) =>
        card.cardCode.toLowerCase().includes(needle) ||
        card.cardName.toLowerCase().includes(needle),
    )
  }, [cards, term])

  if (cards.length === 0) {
    return (
      <EmptyState
        icon={<PackageOpen className="size-10" aria-hidden />}
        title="Tudo tem lugar"
        description="Todas as cópias da sua coleção estão registradas em algum binder, caixa ou deck."
        action={{ label: 'Ver os binders', href: '/binders' }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SearchBar
        label="Buscar entre as cartas sem lugar"
        value={term}
        onValueChange={setTerm}
        placeholder="Buscar por código ou nome..."
      />

      {shown.length === 0 ? (
        <EmptyState title="Nada nesta busca" description="Tente outro código ou nome." />
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
                  {card.loose}
                  <span className="text-text-subtle">/{card.owned}</span>
                </span>
              }
              onClick={() => setPlacing(card)}
            />
          ))}
        </PanelList>
      )}

      {placing ? (
        <PlaceSheet
          card={placing}
          locations={locations}
          onClose={() => setPlacing(null)}
        />
      ) : null}
    </div>
  )
}

function PlaceSheet({
  card,
  locations,
  onClose,
}: {
  card: UnallocatedCard
  locations: StorageLocationSummary[]
  onClose: () => void
}) {
  const [state, action, pending] = useActionState(placeCopiesAction, ALLOCATION_IDLE)
  const [copies, setCopies] = useState(card.loose)
  const { toast } = useToast()

  useEffect(() => {
    if (state.status !== 'saved') return

    // O nome sai da lista que esta tela já tem: o servidor devolve o id, que é
    // o que ele confere contra o dono.
    const where = locations.find((l) => l.id === state.storageLocationId)?.name ?? 'seu local'
    toast({
      title: `Guardada em ${where}`,
      description: `${card.cardCode} — ${card.cardName}`,
      tone: 'success',
    })
    onClose()
  }, [state, card, locations, toast, onClose])

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Guardar em qual local"
      description={`${card.cardCode} — ${card.cardName}`}
    >
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="variantId" value={card.variantId} />

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-text">Quantas cópias</p>
          <QuantitySelector
            value={copies}
            onValueChange={setCopies}
            label="Quantas cópias"
            size="lg"
            min={1}
            max={card.loose}
            disabled={pending}
          />
          <p className="text-xs text-text-muted tabular-nums">
            {card.loose} sem lugar, de {card.owned} que você tem.
          </p>
        </div>

        {state.status === 'error' ? (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        ) : null}

        {/*
          O local viaja no valor do botão que submete, como a quantidade nos
          outros painéis: guardar um estado "local escolhido" e submeter em
          seguida seria uma corrida, e aqui o toque é único — escolher o local
          já é confirmar.
        */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-text">Guardar em</p>
          <PanelList>
            {locations.map((location) => (
              <ListRow
                key={location.id}
                leading={<LocationArt image={location.image} type={location.type} />}
                title={location.name}
                description={location.subtitle}
                trailing={
                  <Button
                    type="submit"
                    name="storageLocationId"
                    value={location.id}
                    variant="secondary"
                    disabled={pending}
                  >
                    Guardar
                  </Button>
                }
                hideChevron
              />
            ))}
          </PanelList>
          <input type="hidden" name="copies" value={copies} />
        </div>
      </form>
    </Sheet>
  )
}
