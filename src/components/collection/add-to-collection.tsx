'use client'

import { useState } from 'react'
import { Plus, SquarePen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QuantitySheet } from './quantity-sheet'

/**
 * O botão que põe uma carta do catálogo na coleção (tela 15).
 *
 * Fica no detalhe da variante. Sem ele o catálogo não leva a lugar nenhum: dá
 * para navegar o jogo inteiro e não registrar uma carta sequer.
 *
 * Ele muda de palavra conforme o estado, porque são intenções diferentes:
 * quem não tem a carta está acrescentando, quem já tem está corrigindo.
 */
export function AddToCollection({
  variantId,
  code,
  name,
  imageUrl,
  labels,
  currentQuantity,
}: {
  variantId: string
  code: string
  name: string
  imageUrl: string | null
  labels?: string[]
  currentQuantity: number
}) {
  const [open, setOpen] = useState(false)
  const owned = currentQuantity > 0

  return (
    <>
      <div className="flex flex-col gap-2">
        {owned ? (
          <p className="text-sm text-text-muted tabular-nums">
            Na sua coleção: <span className="font-semibold text-text">{currentQuantity}</span>
          </p>
        ) : null}

        <Button size="lg" block variant={owned ? 'secondary' : 'primary'} onClick={() => setOpen(true)}>
          {owned ? (
            <>
              <SquarePen className="size-4" aria-hidden />
              Editar quantidade
            </>
          ) : (
            <>
              <Plus className="size-4" aria-hidden />
              Adicionar à coleção
            </>
          )}
        </Button>
      </div>

      <QuantitySheet
        open={open}
        onOpenChange={setOpen}
        variantId={variantId}
        code={code}
        name={name}
        imageUrl={imageUrl}
        labels={labels}
        currentQuantity={currentQuantity}
      />
    </>
  )
}
