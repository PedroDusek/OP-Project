'use client'

import { useActionState, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { CircleCheck, Package } from 'lucide-react'
import { addStarterDeckAction } from '@/app/(app)/binders/actions'
import { ADD_STARTER_DECK_IDLE } from '@/app/(app)/binders/state'
import { CardArt } from '@/components/catalog/card-art'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { QuantitySelector } from '@/components/ui/quantity-selector'
import { SearchBar } from '@/components/ui/search-bar'
import { EmptyState } from '@/components/ui/states'
import { Panel } from '@/components/ui/surface'
import type { StarterDeckContents, StarterDeckOption } from '@/server/application/storage'

/**
 * Pôr num local o deck que vem na caixa de um starter deck (decisão 117).
 *
 * Quem comprou um ST não quer registrar 51 cartas uma a uma. A composição está
 * conferida (decisão 116), e aqui ela entra de uma vez.
 *
 * ## Escolher, ver, confirmar
 *
 * Três passos, e o do meio é o que importa: **adicionar 51 cartas é fácil de
 * fazer e chato de desfazer**. A prévia mostra o líder, as cartas e o total
 * antes do clique — e não há desfazer, porque desfazer exigiria decidir o que
 * fazer com cópias que a pessoa já moveu de lugar.
 *
 * ## Quantas vezes
 *
 * Quem comprou duas caixas tem dois decks. O seletor evita clicar duas vezes e
 * ficar na dúvida se o primeiro clique pegou — que é o jeito de alguém acabar
 * com três.
 */
export function AddStarterDeck({
  storageLocationId,
  locationName,
  options,
  contents,
}: {
  storageLocationId: string
  locationName: string
  options: StarterDeckOption[]
  /** O deck aberto, quando há um. Vem do servidor, pela URL. */
  contents: StarterDeckContents | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [termo, setTermo] = useState('')

  /*
   * A escolha vive na URL, e nao no estado.
   *
   * O conteudo do deck — as 51 cartas com arte e nome — vem do servidor, e
   * guarda-lo no cliente exigiria baixar os 36 de uma vez. Pela URL, recarregar
   * a pagina ou voltar no navegador cai no mesmo lugar.
   */
  const escolher = (code: string | null) => {
    router.push(code === null ? pathname : `${pathname}?deck=${encodeURIComponent(code)}`)
  }

  const encontrados = useMemo(() => {
    const busca = termo.trim().toLowerCase()
    if (!busca) return options
    return options.filter(
      (deck) =>
        deck.displayName.toLowerCase().includes(busca) ||
        deck.displayCode.toLowerCase().includes(busca),
    )
  }, [options, termo])

  if (contents) {
    return (
      <Confirmar
        storageLocationId={storageLocationId}
        locationName={locationName}
        contents={contents}
        onVoltar={() => escolher(null)}
      />
    )
  }

  if (options.length === 0) {
    return (
      <EmptyState
        icon={<Package className="size-10" aria-hidden />}
        title="Nenhum starter deck disponível"
        description="A composição dos decks ainda não foi conferida."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SearchBar
        label="Buscar starter decks"
        value={termo}
        onValueChange={setTermo}
        placeholder="Buscar por código ou nome..."
      />

      {encontrados.length === 0 ? (
        <EmptyState title="Nenhum deck encontrado" description={`Nada corresponde a "${termo}".`} />
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {encontrados.map((deck) => (
            <li key={deck.code}>
              <Panel className="overflow-hidden transition-colors hover:bg-surface-muted">
                <button
                  type="button"
                  onClick={() => escolher(deck.code)}
                  className="flex w-full items-center gap-3 p-3 text-left"
                >
                  <CardArt
                    src={deck.coverUrl}
                    alt=""
                    fallback={deck.displayCode}
                    sizes="44px"
                    className="w-11 shrink-0 rounded-md"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-text">
                      {deck.displayName}
                    </span>
                    <span className="text-xs text-text-muted tabular-nums">
                      {deck.displayCode} · {deck.cards} cartas
                      {deck.leaders > 1 ? ` · ${deck.leaders} líderes` : ''}
                    </span>
                  </span>
                </button>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Confirmar({
  storageLocationId,
  locationName,
  contents,
  onVoltar,
}: {
  storageLocationId: string
  locationName: string
  contents: StarterDeckContents
  onVoltar: () => void
}) {
  const router = useRouter()
  const [estado, enviar, enviando] = useActionState(addStarterDeckAction, ADD_STARTER_DECK_IDLE)
  const [vezes, setVezes] = useState(1)

  if (estado.status === 'added') {
    return (
      <Panel className="flex flex-col gap-3 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-success">
          <CircleCheck className="size-5" aria-hidden />
          {contents.displayName} entrou em {locationName}.
        </p>
        <p className="text-sm text-text-muted tabular-nums">
          {estado.copies} cópias de {estado.cards} cartas
          {estado.times > 1 ? `, o deck ${estado.times} vezes` : ''}.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => router.push(`/binders/${storageLocationId}/cartas`)}>
            Ver as cartas
          </Button>
          {/*
            Voltar para a escolha, e nao repetir daqui: quem quer o mesmo deck
            de novo usa o seletor de vezes, e quem quer outro escolhe outro.
          */}
          <Button variant="secondary" onClick={onVoltar}>
            Escolher outro deck
          </Button>
        </div>
      </Panel>
    )
  }

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="storageLocationId" value={storageLocationId} />
      <input type="hidden" name="deck" value={contents.code} />
      <input type="hidden" name="vezes" value={vezes} />

      <Panel className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{contents.displayName}</p>
            <p className="text-xs text-text-muted tabular-nums">
              {contents.displayCode} · {contents.totalCopies} cartas
              {vezes > 1 ? ` × ${vezes} = ${contents.totalCopies * vezes}` : ''}
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={onVoltar}>
            Trocar
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <span className="text-sm text-text">Quantas vezes</span>
          <QuantitySelector
            label="Quantas vezes o deck entra"
            value={vezes}
            onValueChange={setVezes}
            min={1}
            max={12}
          />
        </div>

        <Button type="submit" disabled={enviando}>
          {enviando
            ? 'Adicionando...'
            : `Adicionar ${contents.totalCopies * vezes} cartas em ${locationName}`}
        </Button>

        {estado.status === 'error' ? (
          <p className="text-sm text-danger" role="alert">
            {estado.message}
          </p>
        ) : null}
      </Panel>

      {/*
        A previa. Adicionar 51 cartas e facil de fazer e chato de desfazer — e
        nao ha desfazer, porque desfazer exigiria decidir o que fazer com copias
        que a pessoa ja moveu de lugar.
      */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text">
          {contents.leaders.length === 1 ? 'O líder' : `Os ${contents.leaders.length} líderes`}
        </h2>
        <Linhas linhas={contents.leaders} vezes={vezes} />

        <h2 className="mt-2 text-sm font-semibold text-text">As {contents.cards.length} cartas</h2>
        <Linhas linhas={contents.cards} vezes={vezes} />
      </section>
    </form>
  )
}

function Linhas({
  linhas,
  vezes,
}: {
  linhas: StarterDeckContents['cards']
  vezes: number
}) {
  return (
    <ul className="flex flex-col gap-2">
      {linhas.map((linha) => (
        <li key={linha.cardVariantId}>
          <Panel className="flex items-center gap-3 p-2">
            <CardArt
              src={linha.imageUrl}
              alt=""
              fallback={linha.cardCode}
              sizes="40px"
              className="w-10 shrink-0 rounded-md"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-text tabular-nums">{linha.cardCode}</p>
              <p className="truncate text-xs text-text-muted">
                {linha.cardName}
                {linha.rarity ? ` · ${linha.rarity}` : ''}
              </p>
            </div>
            <Badge tone="neutral">{linha.copies * vezes}×</Badge>
          </Panel>
        </li>
      ))}
    </ul>
  )
}
