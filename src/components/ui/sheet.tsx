'use client'

import { Dialog, VisuallyHidden } from 'radix-ui'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Bottom sheet no celular, dialogo centrado a partir do `md`.
 *
 * E **um** componente e nao dois porque e o mesmo objeto de interface: filtros,
 * adicionar a colecao e editar quantidade abrem a mesma coisa, e so a posicao
 * na tela muda com o espaco disponivel (`architecture.md` 4.1). Ter dois
 * componentes obrigaria cada tela a escolher, e alguma escolheria diferente.
 *
 * Sobre Radix (decisao de stack em `architecture.md` 1): o que se ganha aqui e
 * o comportamento que quase ninguem escreve inteiro a mao — foco preso dentro
 * do painel, foco devolvido ao elemento que abriu, `Esc` para fechar, rolagem
 * do fundo travada, e o resto da pagina marcado como inerte para o leitor de
 * tela. Escrever isso a mao e possivel; manter certo, dificilmente.
 *
 * `title` e obrigatorio: um dialogo sem nome acessivel e anunciado apenas como
 * "dialogo". Quando o titulo nao deve aparecer na tela, use `hideTitle`, que o
 * mantem na arvore de acessibilidade.
 */

export interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  hideTitle?: boolean
  description?: string
  /** Fixa no rodape do painel, fora da area que rola. */
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function Sheet({
  open,
  onOpenChange,
  title,
  hideTitle = false,
  description,
  footer,
  children,
  className,
}: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-overlay',
            'data-[state=open]:animate-in data-[state=open]:fade-in',
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed z-50 flex flex-col bg-surface text-text',
            // Celular: encostado embaixo, cantos superiores arredondados, no
            // maximo 92% da altura para a tela de tras continuar visivel.
            'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-sheet',
            // Tablet e desktop: centrado, com largura maxima.
            'md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2',
            'md:max-h-[85dvh] md:w-full md:max-w-lg',
            'md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-sheet',
            'shadow-sheet outline-none',
            className,
          )}
        >
          <div className="flex items-start gap-3 px-4 pt-4 pb-3">
            <div className="min-w-0 flex-1">
              {hideTitle ? (
                <VisuallyHidden.Root>
                  <Dialog.Title>{title}</Dialog.Title>
                </VisuallyHidden.Root>
              ) : (
                <Dialog.Title className="text-lg font-semibold text-text">{title}</Dialog.Title>
              )}
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-text-muted">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-muted"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>

          {footer ? (
            <div className="border-t border-border px-4 py-3 pb-safe md:pb-3">{footer}</div>
          ) : (
            <div className="pb-safe md:hidden" />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export const SheetTrigger = Dialog.Trigger
export const SheetClose = Dialog.Close
