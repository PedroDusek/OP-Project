'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Toast } from 'radix-ui'
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Feedback curto (secao 17: Success e Error).
 *
 * O toast **nunca** e o unico lugar onde um erro aparece: ele some sozinho, e
 * quem estava lendo outra parte da tela nao volta a ve-lo. Erro que impede uma
 * acao pertence ao formulario ou ao `ErrorState`; o toast confirma o que ja
 * aconteceu.
 *
 * `Toast.Viewport` do Radix cuida do resto: `role="status"` para nao
 * interromper leitura, pausa ao passar o ponteiro, e o atalho F8 para alcancar
 * a fila pelo teclado.
 *
 * ## O viewport nao pode capturar toque
 *
 * `Toast.Viewport` e um elemento fixo com tamanho proprio: com espacamento e
 * sem nenhum toast, ele continua sendo um retangulo invisivel por cima da
 * pagina. No celular isso cobria a faixa inferior inteira — a barra de
 * navegacao, o botao de carregar mais, os controles de tema — e os toques
 * simplesmente nao chegavam ao que estava embaixo.
 *
 * `pointer-events-none` no viewport e `pointer-events-auto` em cada toast
 * resolve: so o cartao visivel recebe toque, o vazio ao redor nao.
 *
 * ## No celular ele desce do topo
 *
 * O rodape e onde ficam o polegar, a barra de navegacao e a acao principal de
 * quase toda tela. Mesmo sem capturar toque, um cartao ali tapa exatamente o
 * que a pessoa acabou de usar. No topo ele avisa sem entrar na frente.
 */

type ToastTone = 'success' | 'error' | 'info'

interface ToastMessage {
  id: number
  title: string
  description?: string
  tone: ToastTone
}

interface ToastContextValue {
  toast: (message: Omit<ToastMessage, 'id'> | string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const ICONS: Record<ToastTone, React.ElementType> = {
  success: CheckCircle2,
  error: CircleAlert,
  info: Info,
}

const TONES: Record<ToastTone, string> = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-accent-ink',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([])

  const toast = useCallback((message: Omit<ToastMessage, 'id'> | string) => {
    const normalized = typeof message === 'string' ? { title: message, tone: 'info' as const } : message
    setMessages((current) => [...current, { ...normalized, id: Date.now() + current.length }])
  }, [])

  const dismiss = useCallback((id: number) => {
    setMessages((current) => current.filter((message) => message.id !== id))
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      <Toast.Provider swipeDirection="up" duration={4000}>
        {children}

        {messages.map((message) => {
          const Icon = ICONS[message.tone]
          return (
            <Toast.Root
              key={message.id}
              onOpenChange={(open) => {
                if (!open) dismiss(message.id)
              }}
              className={cn(
                'flex items-start gap-3 rounded-card border border-border bg-surface p-3',
                'shadow-raised outline-none',
                // O viewport nao recebe toque; o cartao, sim.
                'pointer-events-auto',
                'data-[swipe=end]:-translate-y-full data-[swipe=move]:translate-y-(--radix-toast-swipe-move-y)',
              )}
            >
              <Icon className={cn('mt-0.5 size-5 shrink-0', TONES[message.tone])} aria-hidden />
              <div className="min-w-0 flex-1">
                <Toast.Title className="text-sm font-medium text-text">{message.title}</Toast.Title>
                {message.description ? (
                  <Toast.Description className="mt-0.5 text-sm text-text-muted">
                    {message.description}
                  </Toast.Description>
                ) : null}
              </div>
              <Toast.Close
                aria-label="Dispensar"
                className="-m-1 shrink-0 rounded p-1 text-text-subtle transition-colors hover:text-text"
              >
                <X className="size-4" aria-hidden />
              </Toast.Close>
            </Toast.Root>
          )
        })}

        <Toast.Viewport
          className={cn(
            'fixed z-60 flex w-full max-w-sm flex-col gap-2 outline-none',
            // Sem isto, o retangulo do viewport engole os toques da faixa que
            // ocupa, com ou sem toast dentro.
            'pointer-events-none',
            // Abaixo da barra superior no celular; canto superior direito a
            // partir do `md`.
            'inset-x-0 top-0 mx-auto p-4 pt-[calc(env(safe-area-inset-top,0px)+4rem)]',
            'md:right-0 md:left-auto md:mx-0 md:pt-4',
          )}
        />
      </Toast.Provider>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast precisa de um <ToastProvider> acima.')
  return context
}
