import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ConversationThread } from '@/components/conversations/conversation-thread'
import { BlockToggle, ReportForm } from '@/components/social/member-actions'
import { readConversation } from '@/server/application/social'
import { NotFoundError } from '@/server/domain/errors'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Conversa', robots: { index: false, follow: false } }

/**
 * Uma conversa (decisão 081).
 *
 * Abrir marca como lida — é o caso de uso que faz isso, a cada vez que a página
 * se desenha, inclusive quando a conversa viva pede para redesenhar. Denunciar e
 * bloquear ficam aqui também, com o que a rede já tem.
 *
 * Quem não participa recebe a página de não encontrada.
 */
export default async function ConversaPage({ params }: PageProps<'/conversas/[id]'>) {
  const { id } = await params
  const viewer = await requireViewer(`/conversas/${id}`)
  if (!/^\d+$/.test(id)) notFound()

  let conversa
  try {
    conversa = await readConversation(viewer, BigInt(id))
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }

  const nome = conversa.otherUsername

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/conversas" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text">
          <ArrowLeft className="size-4" aria-hidden />
          Conversas
        </Link>
        <div className="flex-1" />
      </div>

      <header className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight text-text">
          {nome ? (
            <Link href={`/social/${nome}`} className="hover:underline">
              @{nome}
            </Link>
          ) : (
            'Conta removida'
          )}
        </h1>
        {nome ? (
          <div className="flex flex-wrap items-start gap-2">
            <BlockToggle username={nome} blocked={conversa.viewerBlockedOther} />
            <ReportForm username={nome} />
          </div>
        ) : null}
      </header>

      <ConversationThread
        conversationId={conversa.id}
        messages={conversa.messages}
        sendBlocked={conversa.sendBlocked}
        otherUsername={nome}
      />
    </div>
  )
}
