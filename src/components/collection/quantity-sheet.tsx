'use client'

import { useActionState, useEffect, useState } from 'react'
import { Package, TriangleAlert } from 'lucide-react'
import { setQuantityAction } from '@/app/(app)/colecao/actions'
import { QUANTITY_IDLE } from '@/app/(app)/colecao/state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardArt } from '@/components/catalog/card-art'
import { QuantitySelector } from '@/components/ui/quantity-selector'
import { Sheet } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'

/**
 * Editar quantidade (tela 20).
 *
 * O mesmo painel serve para acrescentar uma carta que ainda não está na coleção
 * e para ajustar uma que já está — é a mesma pergunta, "quantas você tem", e
 * ter duas telas faria a segunda parecer outra coisa.
 *
 * ## Remover é zerar
 *
 * O banco exige `quantity > 0`, então possuir zero é não ter a linha. "Remover
 * da coleção" e "definir para 0" são a mesma escrita, e por isso não existe uma
 * segunda ação capaz de divergir da primeira.
 *
 * ## O conflito da decisão 007, e a resolução
 *
 * Reduzir abaixo do que está guardado em armazenamento não desaloca sozinho: o
 * servidor recusa e devolve onde as cópias estão. A partir daí o painel vira a
 * tela de resolução — a pessoa escolhe **de qual local** cada cópia sai, e a
 * escolha volta junto com a nova quantidade, numa transação só
 * (`business-rules.md` 3.3).
 *
 * Nenhuma retirada vem preenchida. Escolher a ordem por ela — tirar do maior,
 * tirar do primeiro — seria presumir de onde as cartas saíram, que é
 * exatamente o que a regra proíbe.
 */

export interface QuantitySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variantId: string
  code: string
  name: string
  imageUrl: string | null
  labels?: string[]
  /** Quantas a pessoa tem hoje. Zero significa fora da coleção. */
  currentQuantity: number
}

export function QuantitySheet({
  open,
  onOpenChange,
  variantId,
  code,
  name,
  imageUrl,
  labels,
  currentQuantity,
}: QuantitySheetProps) {
  const [state, action, pending] = useActionState(setQuantityAction, QUANTITY_IDLE)
  const [quantity, setQuantity] = useState(() => openingQuantity(currentQuantity))
  const [removals, setRemovals] = useState<Record<string, number>>({})
  const { toast } = useToast()

  // Reabrir o painel parte sempre do que está guardado hoje, e não do que a
  // pessoa digitou e não salvou da última vez.
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setQuantity(openingQuantity(currentQuantity))
      setRemovals({})
    }
  }

  useEffect(() => {
    if (state.status !== 'saved') return

    toast({
      title: state.removed ? 'Removida da coleção' : `Agora você tem ${state.quantity}`,
      description: `${code} — ${name}`,
      tone: 'success',
    })
    onOpenChange(false)
  }, [state, code, name, toast, onOpenChange])

  const conflict = state.status === 'conflict' ? state : null
  const chosen = conflict
    ? conflict.allocations.reduce((sum, a) => sum + (removals[a.storageLocationId] ?? 0), 0)
    : 0
  const missing = conflict
    ? Math.max(0, conflict.allocations.reduce((sum, a) => sum + a.quantity, 0) - chosen - quantity)
    : 0

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={currentQuantity > 0 ? 'Editar quantidade' : 'Adicionar à coleção'}
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
          <p className="text-sm font-medium text-text">Quantidade</p>
          <QuantitySelector
            value={quantity}
            onValueChange={setQuantity}
            label="Quantidade"
            size="lg"
            disabled={pending}
          />
          {currentQuantity > 0 ? (
            <p className="text-xs text-text-muted tabular-nums">Você tem {currentQuantity} hoje.</p>
          ) : null}
        </div>

        {state.status === 'error' ? (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        ) : null}

        {conflict ? (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-control border border-warning/30 bg-warning-soft p-3"
          >
            <p className="flex items-start gap-2 text-sm text-text">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              {conflict.message}
            </p>

            <ul className="flex flex-col gap-3">
              {conflict.allocations.map((allocation) => {
                const chosenHere = removals[allocation.storageLocationId] ?? 0
                return (
                  <li key={allocation.storageLocationId} className="flex flex-col gap-1.5">
                    <span className="flex items-center justify-between gap-2 text-sm text-text">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Package className="size-3.5 shrink-0 text-text-muted" aria-hidden />
                        <span className="truncate">{allocation.storageName}</span>
                      </span>
                      <span className="shrink-0 text-text-muted tabular-nums">
                        {allocation.quantity} guardadas
                      </span>
                    </span>
                    <QuantitySelector
                      label={`Retirar de ${allocation.storageName}`}
                      value={chosenHere}
                      max={allocation.quantity}
                      disabled={pending}
                      onValueChange={(value) =>
                        setRemovals((current) => ({
                          ...current,
                          [allocation.storageLocationId]: value,
                        }))
                      }
                    />
                    {chosenHere > 0 ? (
                      <input
                        type="hidden"
                        name="remocao"
                        value={`${allocation.storageLocationId}:${chosenHere}`}
                      />
                    ) : null}
                  </li>
                )
              })}
            </ul>

            <p className="text-xs text-text-muted tabular-nums">
              {missing > 0
                ? `Escolha de onde saem mais ${missing}.`
                : 'Pronto: as cópias escolhidas saem junto com a redução.'}
            </p>
          </div>
        ) : null}

        {/*
          A quantidade viaja no **valor do botao**, e nao num campo escondido.
          O HTML inclui `name`/`value` de quem submeteu, entao cada botao envia o
          seu numero. A alternativa — zerar o estado no `onClick` e submeter — e
          uma corrida: `setState` e assincrono, e o formulario podia sair com o
          valor anterior.
        */}
        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            name="quantity"
            value={quantity}
            block
            size="lg"
            loading={pending}
            disabled={conflict !== null && missing > 0}
          >
            {conflict ? 'Reduzir e retirar' : quantity === 0 ? 'Remover da coleção' : 'Salvar'}
          </Button>
          {currentQuantity > 0 && quantity !== 0 && !conflict ? (
            <Button type="submit" name="quantity" value={0} variant="danger" block disabled={pending}>
              Remover da coleção
            </Button>
          ) : null}
        </div>
      </form>
    </Sheet>
  )
}

/**
 * Quem ainda não tem a carta abre o painel em 1, e não em 0.
 *
 * Partir de zero deixaria o botão principal dizendo "Remover da coleção" numa
 * carta que a pessoa não tem, e exigiria um toque a mais para o caso normal —
 * acrescentar uma cópia.
 */
function openingQuantity(currentQuantity: number): number {
  return currentQuantity > 0 ? currentQuantity : 1
}
