import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { TradeNegotiation } from '@/components/trades/trade-negotiation'
import { getTrade } from '@/server/application/trades'
import { isAppError } from '@/server/domain/errors'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Troca' }

/**
 * A negociação de uma troca.
 *
 * Quem não participa não entra: a autorização acontece no caso de uso, e o erro
 * dele vira `notFound` aqui. Distinguir "não existe" de "não é sua" contaria a
 * estranhos que aquela troca existe (regra 6.2).
 */
export default async function TrocaPage({ params }: PageProps<'/trocas/[id]'>) {
  const { id } = await params
  const viewer = await requireViewer(`/trocas/${id}`)

  if (!/^\d+$/.test(id)) notFound()

  const trade = await getTrade(viewer, BigInt(id)).catch((error: unknown) => {
    if (isAppError(error)) notFound()
    throw error
  })

  return (
    <>
      <div className="flex items-start gap-3 pb-4">
        <Link
          href="/trocas"
          aria-label="Voltar para Trocas"
          className="-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-muted"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1 pt-2">
          <h1 className="truncate text-2xl font-bold tracking-tight text-text">
            {trade.other ? `Troca com ${trade.other.name}` : 'Troca aguardando alguém'}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Cada um monta a própria oferta. A troca vale quando os dois confirmarem.
          </p>
        </div>
      </div>

      <TradeNegotiation trade={trade} />
    </>
  )
}
