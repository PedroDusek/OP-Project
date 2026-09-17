import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Package } from 'lucide-react'
import { CardArt } from '@/components/catalog/card-art'
import { PageHeader } from '@/components/layout/app-shell'
import { BlockToggle, ReportForm } from '@/components/social/member-actions'
import { Badge } from '@/components/ui/badge'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Panel } from '@/components/ui/surface'
import { readMemberBinder } from '@/server/application/social'
import { NotFoundError, RateLimitError } from '@/server/domain/errors'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Trade Binder', robots: { index: false, follow: false } }

/**
 * O Trade Binder de alguém, visto de dentro da rede (regra 6.1.2, decisão 079).
 *
 * Mostra o nome e as cartas disponíveis — nada mais, e é o caso de uso que
 * garante isso. As cartas que quem olha procura vêm marcadas, e sobem nada: a
 * ordem é a do catálogo, a mesma do link público.
 *
 * O próprio nome manda para Trocas, onde a pessoa vê e organiza o próprio Trade
 * Binder. Nome que não existe e conta que saiu dão a mesma página de não
 * encontrado.
 */
export default async function MemberBinderPage({ params }: PageProps<'/social/[username]'>) {
  const { username } = await params
  const viewer = await requireViewer(`/social/${username}`)

  let binder
  try {
    binder = await readMemberBinder(viewer, decodeURIComponent(username))
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    if (error instanceof RateLimitError) {
      return (
        <ErrorState
          title="Muitas consultas seguidas"
          description={`Espere ${error.retryAfterSeconds} segundos e tente de novo.`}
        />
      )
    }
    throw error
  }
  if (binder === null) redirect('/trocas')

  return (
    <>
      <Link href="/social" className="mb-2 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden />
        Social
      </Link>
      <PageHeader
        title={`@${binder.username}`}
        description={
          binder.blocked
            ? undefined
            : `${binder.cards.length} ${binder.cards.length === 1 ? 'carta' : 'cartas'} · ${binder.copies} ${binder.copies === 1 ? 'cópia' : 'cópias'} disponíveis para troca`
        }
        action={binder.premium ? <Badge tone="accent">Premium</Badge> : undefined}
      />

      <div className="flex flex-col gap-4">
        {binder.blocked ? (
          <Panel className="flex flex-col gap-3 p-4">
            <p className="text-sm text-text">
              Você bloqueou @{binder.username}. Enquanto estiver bloqueado, não aparece para você na rede.
            </p>
            <BlockToggle username={binder.username} blocked />
          </Panel>
        ) : (
          <>
            {binder.interest > 0 ? (
              <p className="text-sm font-medium text-success">
                {binder.interest} {binder.interest === 1 ? 'carta que você procura' : 'cartas que você procura'}
              </p>
            ) : null}

            {binder.cards.length === 0 ? (
              <EmptyState
                icon={<Package className="size-10" aria-hidden />}
                title={`@${binder.username} não tem cartas para troca agora`}
              />
            ) : (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {binder.cards.map((card) => (
                  <li key={card.variantId} className="flex flex-col gap-1.5">
                    <span className="relative block">
                      <CardArt
                        src={card.imageUrl}
                        alt={`${card.cardCode} — ${card.cardName}`}
                        fallback={card.cardCode}
                        sizes="(max-width: 639px) 33vw, (max-width: 767px) 25vw, 17vw"
                      />
                      <span className="absolute right-1 bottom-1 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-bold text-white tabular-nums">
                        x{card.quantity}
                      </span>
                    </span>
                    <span className="truncate text-xs font-semibold text-text tabular-nums">{card.cardCode}</span>
                    <span className="truncate text-xs text-text-muted">{card.cardName}</span>
                    {card.wanted ? <Badge tone="success">Você procura</Badge> : null}
                    {card.variantType !== 'Normal' ? <Badge tone="accent">{card.variantType}</Badge> : null}
                  </li>
                ))}
              </ul>
            )}

            <p className="text-sm text-text-muted">
              Estas cartas estão disponíveis para troca — não estão reservadas para ninguém (regra 4.2).
            </p>

            <div className="flex flex-wrap items-start gap-2 border-t border-border pt-4">
              <BlockToggle username={binder.username} blocked={false} />
              <ReportForm username={binder.username} />
            </div>
          </>
        )}
      </div>
    </>
  )
}
