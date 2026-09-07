'use client'

import { AlertDialog } from 'radix-ui'
import { cn } from '@/lib/cn'
import { Button } from './button'

/**
 * Confirmacao de acao destrutiva.
 *
 * Secao 17 torna a confirmacao obrigatoria em acao destrutiva, e a secao 20
 * repete no criterio de aceite. Existe separado do `Sheet` de proposito: e um
 * `AlertDialog`, que o leitor de tela anuncia com urgencia diferente e que
 * **nao fecha** ao clicar fora nem no `Esc` sem escolha explicita — perder um
 * binder por um toque errado na tela seria irreversivel.
 *
 * O foco inicial vai para cancelar, e nao para confirmar: o padrao de um
 * dialogo destrutivo e nao destruir.
 */

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  /** Acao irreversivel: o botao de confirmar fica em vermelho. */
  destructive?: boolean
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  destructive = true,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <AlertDialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 rounded-t-sheet bg-surface p-4 pb-safe shadow-sheet outline-none',
            'md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-full md:max-w-sm',
            'md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-sheet md:p-5',
          )}
        >
          <AlertDialog.Title className="text-lg font-semibold text-text">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-text-muted">
            {description}
          </AlertDialog.Description>

          <div className="mt-5 flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" block className="md:w-auto">
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant={destructive ? 'danger' : 'primary'}
                block
                loading={loading}
                onClick={onConfirm}
                className="md:w-auto"
              >
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
