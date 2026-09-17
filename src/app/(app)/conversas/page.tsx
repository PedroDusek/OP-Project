import type { Metadata } from 'next'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { EmptyState } from '@/components/ui/states'
import { Panel } from '@/components/ui/surface'
import { cn } from '@/lib/cn'
import { listConversations } from '@/server/application/social'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Conversas' }

/**
 * As conversas com outras pessoas da rede (decisão 081): da mais recente para a
 * mais antiga, com o começo da última mensagem e a marca de não lida.
 *
 * A conversa sem mensagem nenhuma não aparece: abrir uma conversa e não escrever
 * não deve pôr um nome na lista da outra pessoa.
 */
export default async function ConversasPage() {
  const viewer = await requireViewer('/conversas')
  const conversas = await listConversations(viewer)

  return (
    <>
      <PageHeader title="Conversas" description="Combine as trocas com quem você achou na rede." />

      {conversas.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="size-10" aria-hidden />}
          title="Nenhuma conversa ainda"
          description="Abra o Trade Binder de alguém na Social e toque em Mandar mensagem."
          action={{ label: 'Ir para Social', href: '/social' }}
        />
      ) : (
        <Panel className="divide-y divide-border p-0">
          <ul>
            {conversas.map((conversa) => (
              <li key={conversa.id}>
                <Link
                  href={`/conversas/${conversa.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted"
                  aria-label={`Conversa com ${conversa.otherUsername ? `@${conversa.otherUsername}` : 'conta removida'}${conversa.unread ? ', mensagem não lida' : ''}`}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={cn('truncate text-sm text-text', conversa.unread ? 'font-semibold' : 'font-medium')}>
                      {conversa.otherUsername ? `@${conversa.otherUsername}` : 'Conta removida'}
                    </span>
                    <span className={cn('truncate text-sm', conversa.unread ? 'text-text' : 'text-text-muted')}>
                      {conversa.lastFromMe ? 'Você: ' : ''}
                      {conversa.snippet}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-text-subtle tabular-nums">{quando(conversa.lastMessageAt)}</span>
                    {conversa.unread ? <span className="size-2.5 rounded-full bg-danger" aria-hidden /> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  )
}

/** Hoje, a hora; antes, o dia. No fuso de São Paulo, porque renderiza no servidor. */
function quando(valor: Date): string {
  const fuso = 'America/Sao_Paulo'
  const diaDe = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: fuso }).format(d)
  return diaDe(valor) === diaDe(new Date())
    ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: fuso }).format(valor)
    : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: fuso }).format(valor)
}
