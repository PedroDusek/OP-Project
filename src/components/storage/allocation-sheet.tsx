'use client'

import { useActionState, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRightLeft } from 'lucide-react'
import { moveCopiesAction, setAllocationAction } from '@/app/(app)/binders/actions'
import { ALLOCATION_IDLE, MOVE_IDLE } from '@/app/(app)/binders/state'
import { Button } from '@/components/ui/button'
import { CardArt } from '@/components/catalog/card-art'
import { QuantitySelector } from '@/components/ui/quantity-selector'
import { Sheet } from '@/components/ui/sheet'
import { ListRow, PanelList } from '@/components/ui/surface'
import { useToast } from '@/components/ui/toast'
import type { StorageLocationSummary } from '@/server/application/storage'
import { LocationArt } from './location-art'

/**
 * Quantas cópias desta carta estão neste local — e para onde elas podem ir.
 *
 * O mesmo painel serve para guardar a primeira cópia e para corrigir quantas
 * estão ali: é a mesma escrita, e duas telas fariam a segunda parecer outra
 * coisa. É o irmão de `QuantitySheet`, que responde "quantas você tem"; este
 * responde "quantas estão aqui".
 *
 * ## Duas vistas, um painel
 *
 * Ajustar e transferir são perguntas diferentes, e cada uma tem a sua
 * quantidade. Mostradas juntas, dois seletores lado a lado se confundiriam —
 * "cópias neste local" e "quantas mover" são números distintos que parecem o
 * mesmo. Então o painel troca de vista, e cada vista tem um número só.
 *
 * O teto vem do servidor: `max` é quanto ainda cabe, já descontado o que está
 * nos outros locais. Ele existe para o controle não oferecer um número que a
 * escrita vai recusar — a recusa continua sendo do servidor, que é quem trava a
 * linha e enxerga a soma real.
 */

export interface AllocationSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variantId: string
  code: string
  name: string
  imageUrl: string | null
  storageLocationId: string
  locationName: string
  locationSubtitle?: string
  currentQuantity: number
  /** Quanto cabe aqui, contando o que já está neste local. */
  max: number
  /** Os outros locais, para transferir. Ausente esconde a transferência. */
  locations?: StorageLocationSummary[]
}

export function AllocationSheet(props: AllocationSheetProps) {
  const { open, onOpenChange, code, name, currentQuantity, locations, storageLocationId } = props
  const [moving, setMoving] = useState(false)

  // Reabrir sempre começa pelo ajuste, e não pela vista onde ficou da última vez.
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setMoving(false)
  }

  const elsewhere = (locations ?? []).filter((location) => location.id !== storageLocationId)
  const canMove = currentQuantity > 0 && elsewhere.length > 0

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={moving ? 'Mover para outro local' : title(currentQuantity, props.locationName)}
      description={`${code} — ${name}`}
    >
      {moving ? (
        <MoveView {...props} locations={elsewhere} onBack={() => setMoving(false)} />
      ) : (
        <QuantityView {...props} onMove={canMove ? () => setMoving(true) : undefined} />
      )}
    </Sheet>
  )
}

function title(currentQuantity: number, locationName: string): string {
  return currentQuantity > 0 ? 'Quantas estão aqui' : `Guardar em ${locationName}`
}

function CardSummary({
  code,
  name,
  imageUrl,
  line,
}: {
  code: string
  name: string
  imageUrl: string | null
  line: string
}) {
  return (
    <div className="flex items-center gap-3">
      <CardArt src={imageUrl} alt="" fallback={code} sizes="72px" className="w-18 shrink-0" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="truncate text-sm font-semibold text-text tabular-nums">{code}</p>
        <p className="truncate text-sm text-text-muted">{name}</p>
        <p className="truncate text-xs text-text-subtle">{line}</p>
      </div>
    </div>
  )
}

function QuantityView({
  onOpenChange,
  variantId,
  code,
  name,
  imageUrl,
  storageLocationId,
  locationName,
  locationSubtitle,
  currentQuantity,
  max,
  onMove,
}: AllocationSheetProps & { onMove?: () => void }) {
  const [state, action, pending] = useActionState(setAllocationAction, ALLOCATION_IDLE)
  const [quantity, setQuantity] = useState(currentQuantity)
  const { toast } = useToast()

  useEffect(() => {
    if (state.status !== 'saved') return

    toast({
      title:
        state.quantity === 0 ? `Retirada de ${locationName}` : `${state.quantity} em ${locationName}`,
      description: `${code} — ${name}`,
      tone: 'success',
    })
    onOpenChange(false)
  }, [state, code, name, locationName, toast, onOpenChange])

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="variantId" value={variantId} />
      <input type="hidden" name="storageLocationId" value={storageLocationId} />

      <CardSummary
        code={code}
        name={name}
        imageUrl={imageUrl}
        line={locationSubtitle ? `${locationName} · ${locationSubtitle}` : locationName}
      />

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-text">Cópias neste local</p>
        <QuantitySelector
          value={quantity}
          onValueChange={setQuantity}
          label="Cópias neste local"
          size="lg"
          max={max}
          disabled={pending}
        />
        <p className="text-xs text-text-muted tabular-nums">
          {max === 0
            ? 'Todas as suas cópias já estão em outros locais.'
            : `Cabem até ${max} aqui, contando o que está em outros locais.`}
        </p>
      </div>

      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      ) : null}

      {/*
        A quantidade viaja no valor do botão que submete, e não num campo
        sincronizado por estado: `setState` é assíncrono, e zerar no `onClick`
        para submeter em seguida enviaria o valor anterior.
      */}
      <div className="flex flex-col gap-2">
        <Button type="submit" name="quantity" value={quantity} block size="lg" loading={pending}>
          {quantity === 0 ? 'Retirar daqui' : 'Salvar'}
        </Button>

        {onMove ? (
          <Button type="button" variant="secondary" block onClick={onMove} disabled={pending}>
            <ArrowRightLeft className="size-4" aria-hidden />
            Mover para outro local
          </Button>
        ) : null}

        {currentQuantity > 0 && quantity !== 0 ? (
          <Button type="submit" name="quantity" value={0} variant="danger" block disabled={pending}>
            Retirar daqui
          </Button>
        ) : null}
      </div>
    </form>
  )
}

/**
 * Transferir.
 *
 * O destino viaja no valor do botão que submete, como em toda escolha destes
 * painéis: guardar "destino escolhido" num estado e submeter em seguida seria
 * uma corrida, e aqui escolher o destino já é confirmar.
 */
function MoveView({
  onOpenChange,
  variantId,
  code,
  name,
  imageUrl,
  storageLocationId,
  locationName,
  currentQuantity,
  locations,
  onBack,
}: AllocationSheetProps & { locations: StorageLocationSummary[]; onBack: () => void }) {
  const [state, action, pending] = useActionState(moveCopiesAction, MOVE_IDLE)
  const [copies, setCopies] = useState(currentQuantity)
  const { toast } = useToast()

  useEffect(() => {
    if (state.status !== 'moved') return

    const destino = locations.find((l) => l.id === state.toStorageLocationId)?.name ?? 'outro local'
    toast({
      title: `${state.copies} ${state.copies === 1 ? 'cópia movida' : 'cópias movidas'} para ${destino}`,
      description: `${code} — ${name}`,
      tone: 'success',
    })
    onOpenChange(false)
  }, [state, code, name, locations, toast, onOpenChange])

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="variantId" value={variantId} />
      <input type="hidden" name="fromStorageLocationId" value={storageLocationId} />
      <input type="hidden" name="copies" value={copies} />

      <CardSummary code={code} name={name} imageUrl={imageUrl} line={`Saindo de ${locationName}`} />

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-text">Quantas mover</p>
        <QuantitySelector
          value={copies}
          onValueChange={setCopies}
          label="Quantas mover"
          size="lg"
          min={1}
          max={currentQuantity}
          disabled={pending}
        />
        <p className="text-xs text-text-muted tabular-nums">
          {currentQuantity} {currentQuantity === 1 ? 'cópia' : 'cópias'} em {locationName}.
        </p>
      </div>

      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-text">Mover para</p>
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
                  name="toStorageLocationId"
                  value={location.id}
                  variant="secondary"
                  disabled={pending}
                >
                  Mover
                </Button>
              }
              hideChevron
            />
          ))}
        </PanelList>
      </div>

      <Button type="button" variant="ghost" block onClick={onBack} disabled={pending}>
        <ArrowLeft className="size-4" aria-hidden />
        Voltar
      </Button>
    </form>
  )
}
