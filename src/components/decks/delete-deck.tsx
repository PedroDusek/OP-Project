'use client'

import { useActionState, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ListRow } from '@/components/ui/surface'
import { excluirDeckAction } from '@/app/(app)/deck/actions'
import { DECK_DELETE_IDLE } from '@/app/(app)/deck/state'

/**
 * Excluir uma decklist (decisão 108).
 *
 * A confirmação é obrigatória em ação destrutiva (design-system.md), e aqui ela
 * é `destructive`, ao contrário da do binder: apagar um local deixa as cartas
 * na coleção, e apagar uma lista não deixa nada. Por isso o texto do diálogo
 * diz o contrário do de lá — não há o que preservar, e prometer o contrário
 * seria pior que não dizer nada.
 *
 * O diálogo confirma e o envio é feito pelo próprio formulário
 * (`requestSubmit`), em vez de uma chamada solta à ação: assim o `pending` do
 * `useActionState` vale para o botão, e o clique duplo não dispara duas
 * exclusões.
 *
 * ## Dois lugares, e o motivo de cada um
 *
 * `variant="linha"` é o rodapé da tela de detalhe, igual ao binder. `variant="icone"`
 * é a linha de `/deck`, que existe porque **a tela de detalhe não abre sem
 * Premium** — e o caso de uso é explícito em deixar apagar sem Premium. Só no
 * detalhe, quem deixou de assinar ficaria presa a uma lista que não consegue
 * nem abrir nem apagar.
 */
export function DeleteDeck({
  id,
  name,
  variant = 'linha',
}: {
  id: string
  name: string
  variant?: 'linha' | 'icone'
}) {
  const [state, submit, pending] = useActionState(excluirDeckAction, DECK_DELETE_IDLE)
  const [open, setOpen] = useState(false)
  const form = useRef<HTMLFormElement>(null)

  return (
    <>
      {variant === 'linha' ? (
        <ListRow
          tone="danger"
          leading={<Trash2 className="size-5 text-danger" aria-hidden />}
          title="Excluir lista"
          onClick={() => setOpen(true)}
          hideChevron
        />
      ) : (
        /*
         * `md` e não `sm`: 44 px de alvo de toque, que a seção 3.4 exige para o
         * dedo. O `sm` existe para linha de lista no desktop, e este produto é
         * mobile-first.
         */
        <Button
          variant="danger"
          size="md"
          className="shrink-0 px-3"
          onClick={() => setOpen(true)}
          aria-label={`Excluir ${name}`}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      )}

      <form ref={form} action={submit} className="hidden">
        <input type="hidden" name="id" value={id} />
      </form>

      {state.status === 'error' && state.message ? (
        <p role="alert" className="px-4 py-2 text-sm text-danger">
          {state.message}
        </p>
      ) : null}

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Excluir ${name}?`}
        description="A lista é apagada e não dá para desfazer. Suas cartas não são tocadas: a decklist só registra quais cartas o deck pede."
        confirmLabel="Excluir"
        destructive
        loading={pending}
        onConfirm={() => form.current?.requestSubmit()}
      />
    </>
  )
}
