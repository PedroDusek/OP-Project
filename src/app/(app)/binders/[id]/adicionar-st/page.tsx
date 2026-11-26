import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { AddStarterDeck } from '@/components/storage/add-starter-deck'
import { isAppError } from '@/server/domain/errors'
import {
  getStorageLocation,
  listStarterDeckOptions,
  readStarterDeckContents,
} from '@/server/application/storage'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Adicionar ST' }

/**
 * Pôr num local o deck que vem na caixa de um starter deck (decisão 117).
 *
 * Entra-se por um local, como "Adicionar cartas", e pelo mesmo motivo: a
 * operação tem um destino, e o destino é este local. Vale em **todo** local —
 * binder, caixa e deckbox —, escolha do dono do produto: quem comprou um ST
 * pode querer guardá-lo em qualquer um, e esconder a opção em alguns seria
 * decidir pela pessoa.
 *
 * O deck escolhido vem pela URL (`?deck=ST-01`), e não do estado do cliente: as
 * 51 cartas com arte e nome vêm do servidor, e guardá-las no cliente exigiria
 * baixar os 36 decks de uma vez.
 */
export default async function AdicionarStPage({
  params,
  searchParams,
}: PageProps<'/binders/[id]/adicionar-st'>) {
  const { id } = await params
  const viewer = await requireViewer(`/binders/${id}/adicionar-st`)

  if (!/^\d+$/.test(id)) notFound()

  const query = await searchParams
  const pedido = Array.isArray(query.deck) ? query.deck[0] : query.deck

  const [location, options] = await Promise.all([
    getStorageLocation(viewer, BigInt(id)),
    listStarterDeckOptions(),
  ])
  if (!location) notFound()

  /*
   * Deck que nao existe ou sem composicao conferida cai na escolha, e nao em
   * erro: o endereco pode ter sido guardado antes de a tabela mudar, e mandar a
   * pessoa para a lista responde melhor que uma tela de falha.
   */
  const contents = pedido
    ? await readStarterDeckContents(pedido).catch((error) => {
        if (isAppError(error) && error.kind === 'NOT_FOUND') return null
        throw error
      })
    : null

  return (
    <>
      <div className="flex items-start gap-3 pb-4">
        <Link
          href={`/binders/${location.id}`}
          aria-label={`Voltar para ${location.name}`}
          className="-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-muted"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1 pt-2">
          <h1 className="truncate text-2xl font-bold tracking-tight text-text">Adicionar ST</h1>
          <p className="mt-1 text-sm text-text-muted">
            O deck que vem na caixa, inteiro, em {location.name}. O líder e as 50 cartas; os DON!!
            não entram.
          </p>
        </div>
      </div>

      <AddStarterDeck
        storageLocationId={String(location.id)}
        locationName={location.name}
        options={options}
        contents={contents}
      />
    </>
  )
}
