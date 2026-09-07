'use client'

import { useActionState, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ListRow } from '@/components/ui/surface'
import { deleteLocationAction } from '@/app/(app)/binders/actions'
import { LOCATION_IDLE } from '@/app/(app)/binders/state'

/**
 * Excluir um local (tela 22).
 *
 * A confirmação é obrigatória em ação destrutiva (seção 17), e o texto diz o
 * que **não** acontece: as cartas continuam na coleção. Sem essa frase, "excluir
 * o binder" parece que apaga as cartas, e ninguém toca no botão para descobrir.
 *
 * O diálogo confirma e o envio é feito pelo próprio formulário
 * (`requestSubmit`), em vez de uma chamada solta à ação: assim o `pending` do
 * `useActionState` vale para o botão, e o clique duplo não dispara duas
 * exclusões.
 */
export function DeleteLocation({ id, name }: { id: string; name: string }) {
  const [state, submit, pending] = useActionState(deleteLocationAction, LOCATION_IDLE)
  const [open, setOpen] = useState(false)
  const form = useRef<HTMLFormElement>(null)

  return (
    <>
      <ListRow
        tone="danger"
        leading={<Trash2 className="size-5 text-danger" aria-hidden />}
        title="Excluir local"
        onClick={() => setOpen(true)}
        hideChevron
      />

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
        description="O local e o registro de onde as cartas estavam são apagados. As cartas continuam na sua coleção, sem lugar registrado."
        confirmLabel="Excluir"
        loading={pending}
        onConfirm={() => form.current?.requestSubmit()}
      />
    </>
  )
}
