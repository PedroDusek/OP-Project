'use client'

import { useActionState, useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { setWantAction } from '@/app/(app)/colecao/actions'
import { WANT_IDLE } from '@/app/(app)/colecao/state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardArt } from '@/components/catalog/card-art'
import { QuantitySelector } from '@/components/ui/quantity-selector'
import { Sheet } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { WANT_STATUS_LABEL, wantStatus } from '@/server/domain/wants/status'

/**
 * Quantas cópias desta variante a pessoa quer (tela 30).
 *
 * O mesmo painel acrescenta à want list e corrige o que já está lá — é a mesma
 * pergunta, "quantas você quer", e duas telas fariam a segunda parecer outra
 * coisa. É o irmão de `QuantitySheet`, que responde "quantas você tem".
 *
 * Não há campo de anotação nem prioridade: `business-rules.md` 4.4 é explícita,
 * e a tela de referência mostrava um campo que a regra exclui. A regra venceu,
 * com o dono do produto de acordo.
 *
 * "Já consegui" aparece como estado, e não como botão de arquivar: um want
 * satisfeito continua na lista até a pessoa tirá-lo. Quem quis quatro e tem
 * quatro pode querer uma quinta para trocar.
 */

export interface WantSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variantId: string
  code: string
  name: string
  imageUrl: string | null
  labels?: string[]
  /** Quantas a pessoa quer hoje. Zero significa fora da lista. */
  currentQuantity: number
  /** Quantas ela já tem, para o painel dizer o que ainda falta. */
  owned: number
}

export function WantSheet({
  open,
  onOpenChange,
  variantId,
  code,
  name,
  imageUrl,
  labels,
  currentQuantity,
  owned,
}: WantSheetProps) {
  const [state, action, pending] = useActionState(setWantAction, WANT_IDLE)
  const [quantity, setQuantity] = useState(() => openingQuantity(currentQuantity))
  const { toast } = useToast()

  // Reabrir parte do que está guardado hoje, e não do que ficou digitado.
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setQuantity(openingQuantity(currentQuantity))
  }

  useEffect(() => {
    if (state.status !== 'saved') return

    toast({
      title: state.removed ? 'Fora da want list' : `Quero ${state.quantity}`,
      description: `${code} — ${name}`,
      tone: 'success',
    })
    onOpenChange(false)
  }, [state, code, name, toast, onOpenChange])

  const status = wantStatus(owned, quantity)

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={currentQuantity > 0 ? 'Quantas você quer' : 'Adicionar à want list'}
      description={`${code} — ${name}`}
    >
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="variantId" value={variantId} />

        <div className="flex items-center gap-3">
          <CardArt src={imageUrl} alt="" fallback={code} sizes="72px" className="w-18 shrink-0" />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-sm font-semibold text-text tabular-nums">{code}</p>
            <p className="truncate text-sm text-text-muted">{name}</p>
            {labels?.length ? (
              <span className="mt-0.5 flex flex-wrap gap-1">
                {labels.map((label) => (
                  <Badge key={label} tone="accent">
                    {label}
                  </Badge>
                ))}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-text">Quero na minha coleção</p>
          <QuantitySelector
            value={quantity}
            onValueChange={setQuantity}
            label="Quero na minha coleção"
            size="lg"
            disabled={pending}
          />
          <p className="text-xs text-text-muted tabular-nums">
            {WANT_STATUS_LABEL[status]}
            {owned > 0 ? ` · você tem ${owned}` : ''}
          </p>
        </div>

        {state.status === 'error' ? (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        ) : null}

        {/*
          A quantidade viaja no valor do botão que submete, como nos outros
          painéis: `setState` é assíncrono, e zerar no `onClick` para submeter em
          seguida enviaria o valor anterior.
        */}
        <div className="flex flex-col gap-2">
          <Button type="submit" name="quantity" value={quantity} block size="lg" loading={pending}>
            {quantity === 0 ? 'Tirar da want list' : 'Salvar'}
          </Button>
          {currentQuantity > 0 && quantity !== 0 ? (
            <Button type="submit" name="quantity" value={0} variant="danger" block disabled={pending}>
              Tirar da want list
            </Button>
          ) : null}
        </div>
      </form>
    </Sheet>
  )
}

/**
 * Quem ainda não quer a carta abre o painel em 1, e não em 0.
 *
 * Partir de zero deixaria o botão principal dizendo "tirar da want list" numa
 * carta que nem está nela, e exigiria um toque a mais para o caso normal.
 */
function openingQuantity(currentQuantity: number): number {
  return currentQuantity > 0 ? currentQuantity : 1
}

/** O botão do detalhe da carta, que abre o painel. */
export function WantButton({
  variantId,
  code,
  name,
  imageUrl,
  labels,
  currentQuantity,
  owned,
}: Omit<WantSheetProps, 'open' | 'onOpenChange'>) {
  const [open, setOpen] = useState(false)
  const wanted = currentQuantity > 0

  return (
    <>
      <Button
        variant={wanted ? 'soft' : 'secondary'}
        block
        onClick={() => setOpen(true)}
        aria-label={wanted ? `Quero ${currentQuantity}, editar` : 'Adicionar à want list'}
      >
        <Heart className={wanted ? 'size-4 fill-current' : 'size-4'} aria-hidden />
        {wanted ? `Quero ${currentQuantity}` : 'Quero esta carta'}
      </Button>

      <WantSheet
        open={open}
        onOpenChange={setOpen}
        variantId={variantId}
        code={code}
        name={name}
        imageUrl={imageUrl}
        labels={labels}
        currentQuantity={currentQuantity}
        owned={owned}
      />
    </>
  )
}
