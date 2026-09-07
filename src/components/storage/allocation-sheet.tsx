'use client'

import { useActionState, useEffect, useState } from 'react'
import { setAllocationAction } from '@/app/(app)/armazenamento/actions'
import { ALLOCATION_IDLE } from '@/app/(app)/armazenamento/state'
import { Button } from '@/components/ui/button'
import { CardArt } from '@/components/catalog/card-art'
import { QuantitySelector } from '@/components/ui/quantity-selector'
import { Sheet } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'

/**
 * Quantas cópias desta carta estão neste local.
 *
 * O mesmo painel serve para guardar a primeira cópia e para corrigir quantas
 * estão ali — é a mesma escrita, e duas telas fariam a segunda parecer outra
 * coisa. É o irmão de `QuantitySheet`, que responde "quantas você tem"; este
 * responde "quantas estão aqui".
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
}

export function AllocationSheet({
  open,
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
}: AllocationSheetProps) {
  const [state, action, pending] = useActionState(setAllocationAction, ALLOCATION_IDLE)
  const [quantity, setQuantity] = useState(currentQuantity)
  const { toast } = useToast()

  // Reabrir parte do que está guardado hoje, e não do que ficou digitado.
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setQuantity(currentQuantity)
  }

  useEffect(() => {
    if (state.status !== 'saved') return

    toast({
      title:
        state.quantity === 0
          ? `Retirada de ${state.locationName}`
          : `${state.quantity} em ${state.locationName}`,
      description: `${code} — ${name}`,
      tone: 'success',
    })
    onOpenChange(false)
  }, [state, code, name, toast, onOpenChange])

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={currentQuantity > 0 ? 'Quantas estão aqui' : `Guardar em ${locationName}`}
      description={`${code} — ${name}`}
    >
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="variantId" value={variantId} />
        <input type="hidden" name="storageLocationId" value={storageLocationId} />
        <input type="hidden" name="locationName" value={locationName} />

        <div className="flex items-center gap-3">
          <CardArt src={imageUrl} alt="" fallback={code} sizes="72px" className="w-18 shrink-0" />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-sm font-semibold text-text tabular-nums">{code}</p>
            <p className="truncate text-sm text-text-muted">{name}</p>
            <p className="truncate text-xs text-text-subtle">
              {locationName}
              {locationSubtitle ? ` · ${locationSubtitle}` : ''}
            </p>
          </div>
        </div>

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
          {currentQuantity > 0 && quantity !== 0 ? (
            <Button type="submit" name="quantity" value={0} variant="danger" block disabled={pending}>
              Retirar daqui
            </Button>
          ) : null}
        </div>
      </form>
    </Sheet>
  )
}
