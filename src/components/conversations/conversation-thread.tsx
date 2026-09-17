'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SendHorizontal } from 'lucide-react'
import { sendMessageAction } from '@/app/(app)/conversas/actions'
import { SEND_MESSAGE_IDLE } from '@/app/(app)/conversas/state'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/field'
import { cn } from '@/lib/cn'
import type { ConversationMessage } from '@/server/application/social'
import { MESSAGE_MAX } from '@/server/domain/social/conversations'

/**
 * A conversa aberta: as mensagens e o campo de escrever (decisão 081).
 *
 * ## Viva, como a troca
 *
 * Pergunta a cada três segundos se chegou mensagem ou se o bloqueio mudou, e
 * redesenha a página quando muda — a mesma forma da troca ao vivo (decisão 065).
 * É ao se redesenhar que a página marca como lida, então quem está com a
 * conversa aberta não acende o próprio sino. Pausa com a aba escondida.
 *
 * ## A mais recente embaixo
 *
 * Como em qualquer aplicativo de conversa: abre rolado até o fim, e desce sozinho
 * quando chega mensagem nova.
 */

const INTERVALO_MS = 3_000

export interface ConversationThreadProps {
  conversationId: string
  messages: ConversationMessage[]
  sendBlocked: string | null
  otherUsername: string | null
}

function useLiveConversation(conversationId: string) {
  const router = useRouter()
  const ultima = useRef<string | null>(null)

  useEffect(() => {
    let cancelado = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function perguntar() {
      try {
        const resposta = await fetch(`/api/conversas/${conversationId}/estado`, { cache: 'no-store' })
        if (!resposta.ok || cancelado) return
        const corpo = JSON.stringify(await resposta.json())
        // A primeira resposta so estabelece a referencia: a pagina acabou de chegar.
        if (ultima.current !== null && corpo !== ultima.current) router.refresh()
        ultima.current = corpo
      } catch {
        // Rede instavel nao derruba a conversa: a proxima pergunta tenta de novo.
      }
    }

    function agendar() {
      timer = setTimeout(async () => {
        if (document.visibilityState === 'visible') await perguntar()
        if (!cancelado) agendar()
      }, INTERVALO_MS)
    }

    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void perguntar()
    }

    void perguntar()
    agendar()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      cancelado = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [conversationId, router])
}

const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const dia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })

export function ConversationThread({ conversationId, messages, sendBlocked, otherUsername }: ConversationThreadProps) {
  useLiveConversation(conversationId)
  const [state, enviar, enviando] = useActionState(sendMessageAction, SEND_MESSAGE_IDLE)
  const [texto, setTexto] = useState('')
  const fim = useRef<HTMLDivElement>(null)
  const [enviadaEm, setEnviadaEm] = useState(0)

  // Enviada, o campo esvazia. Pela marca do envio, e nao por efeito a cada
  // renderizacao: o texto que a pessoa comecou a digitar depois nao some.
  if (state.status === 'sent' && state.at !== enviadaEm) {
    setEnviadaEm(state.at)
    setTexto('')
  }

  const ultimaId = messages.at(-1)?.id
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' })
  }, [ultimaId])

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2" aria-label={`Mensagens com ${otherUsername ? `@${otherUsername}` : 'conta removida'}`}>
        {messages.length === 0 ? (
          <li className="py-8 text-center text-sm text-text-muted">
            Nenhuma mensagem ainda. Combine a troca por aqui — sem telefone, sem sair do ColeXa.
          </li>
        ) : (
          messages.map((mensagem) => (
            <li key={mensagem.id} className={cn('flex', mensagem.mine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] rounded-card px-3 py-2',
                  mensagem.mine ? 'bg-accent text-white' : 'border border-border bg-surface text-text',
                )}
              >
                <p className="text-sm break-words whitespace-pre-wrap">{mensagem.body}</p>
                <p className={cn('mt-1 text-right text-[11px] tabular-nums', mensagem.mine ? 'text-white/75' : 'text-text-subtle')}>
                  <span className="sr-only">{mensagem.mine ? 'Você, ' : ''}</span>
                  {dia.format(new Date(mensagem.createdAt))} {hora.format(new Date(mensagem.createdAt))}
                </p>
              </div>
            </li>
          ))
        )}
      </ol>
      <div ref={fim} />

      {sendBlocked ? (
        <p className="rounded-card border border-border bg-surface-muted px-3 py-2 text-sm text-text-muted">{sendBlocked}</p>
      ) : (
        <form action={enviar} className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-surface pt-3 pb-2">
          <input type="hidden" name="conversa" value={conversationId} />
          <div className="flex items-end gap-2">
            <Textarea
              name="mensagem"
              aria-label="Mensagem"
              placeholder="Escreva uma mensagem"
              rows={2}
              maxLength={MESSAGE_MAX}
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              onKeyDown={(event) => {
                // Enter envia; Shift+Enter quebra a linha.
                if (event.key === 'Enter' && !event.shiftKey && texto.trim() !== '') {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
              className="min-h-11 flex-1 resize-none"
            />
            <Button type="submit" loading={enviando} disabled={texto.trim() === ''} aria-label="Enviar mensagem">
              <SendHorizontal className="size-4" aria-hidden />
            </Button>
          </div>
          {state.status === 'error' ? (
            <p role="alert" className="text-sm text-danger">
              {state.message}
            </p>
          ) : null}
        </form>
      )}
    </div>
  )
}
