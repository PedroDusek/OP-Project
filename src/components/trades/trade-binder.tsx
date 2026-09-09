'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CardArt } from '@/components/catalog/card-art'
import { CardGrid, CardTile } from '@/components/catalog/card-tile'
import { SearchBar } from '@/components/ui/search-bar'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState } from '@/components/ui/states'
import { ListRow, PanelList } from '@/components/ui/surface'
import type { TradeBinderCard } from '@/server/application/trades'

/**
 * O Trade Binder (tela 31).
 *
 * ## O que ele é, e o que a tela precisa dizer
 *
 * É a soma do que está em armazenamento com finalidade de troca, entre todos os
 * locais. Não é uma lista separada que se monta aqui: quem quer mudar o que
 * está disponível mexe nos binders, e a tela leva para lá em vez de oferecer um
 * segundo jeito de fazer a mesma coisa.
 *
 * "Trade Binder" sugere um lugar onde as cartas ficam reservadas, e **não é**:
 * estar aqui significa disponível, não comprometido com ninguém
 * (`business-rules.md` 4.2). A tela diz isso, porque o nome sozinho engana.
 *
 * ## Duas contagens, porque são duas perguntas
 *
 * Quantas cartas distintas e quantas cópias. Quem procura uma carta pensa em
 * cartas; quem oferece uma troca pensa em cópias, e oferecer três Zoro é
 * diferente de oferecer três cartas.
 *
 * ## Busca no cliente, como nas outras listas
 *
 * As cartas já vieram todas — um Trade Binder tem dezenas ou centenas, não
 * milhares — e uma ida ao servidor a cada tecla seria mais lenta que o filtro.
 * Mesmo arranjo da tela 23, e de propósito: é a mesma gestualidade.
 */

type Layout = 'grid' | 'list'

export function TradeBinder({ cards }: { cards: TradeBinderCard[] }) {
  const [layout, setLayout] = useState<Layout>('grid')
  const [term, setTerm] = useState('')

  const shown = useMemo(() => {
    const needle = term.trim().toLowerCase()
    if (!needle) return cards
    return cards.filter(
      (card) =>
        card.cardCode.toLowerCase().includes(needle) ||
        card.cardName.toLowerCase().includes(needle),
    )
  }, [cards, term])

  if (cards.length === 0) {
    return (
      <EmptyState
        title="Nada disponível para troca"
        description="O Trade Binder é a soma do que está guardado em binders e caixas com finalidade de troca. Marque um local como Troca, ou guarde cartas num que já seja."
        action={{ label: 'Ver meus binders', href: '/binders' }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SearchBar
        label="Buscar no Trade Binder"
        value={term}
        onValueChange={setTerm}
        placeholder="Buscar por código ou nome..."
      />

      <Segmented
        label="Modo de exibição"
        value={layout}
        onValueChange={setLayout}
        options={[
          { value: 'grid' as const, label: 'Grid' },
          { value: 'list' as const, label: 'Lista' },
        ]}
      />

      {shown.length === 0 ? (
        <EmptyState title="Nada nesta busca" description="Tente outro código ou nome." />
      ) : layout === 'grid' ? (
        <CardGrid>
          {shown.map((card, index) => (
            <CardTile
              key={card.variantId}
              code={card.cardCode}
              name={card.cardName}
              imageUrl={card.imageUrl}
              quantity={card.quantity}
              labels={labelsFor(card)}
              href={`/catalogo/carta/${card.variantId}`}
              priority={index < 3}
            />
          ))}
        </CardGrid>
      ) : (
        <PanelList>
          {shown.map((card) => (
            <ListRow
              key={card.variantId}
              leading={
                <CardArt
                  src={card.imageUrl}
                  alt=""
                  fallback={card.cardCode}
                  sizes="44px"
                  className="w-11 rounded-md"
                />
              }
              title={card.cardCode}
              description={card.cardName}
              href={`/catalogo/carta/${card.variantId}`}
              trailing={
                <span className="text-sm font-semibold text-text tabular-nums">
                  {card.quantity}
                  <span className="text-text-subtle">/{card.ownedQuantity}</span>
                </span>
              }
            />
          ))}
        </PanelList>
      )}
    </div>
  )
}

/**
 * O que distingue esta carta das outras da mesma linha.
 *
 * "Em 2 locais" entra porque muda o que acontece ao concluir um trade: com as
 * cópias num lugar só, de onde elas saem é dedução; espalhadas, a regra 4.6
 * manda perguntar. Quem vê antes não é pego de surpresa depois.
 */
function labelsFor(card: TradeBinderCard): string[] {
  const labels = [card.rarity, card.variantType === 'Normal' ? null : card.variantType].filter(
    (label): label is string => Boolean(label),
  )
  if (card.locationCount > 1) labels.push(`em ${card.locationCount} locais`)
  return labels
}

/**
 * O cabeçalho: as duas contagens e o aviso de que isto não é reserva.
 *
 * Fica no servidor, e não aqui dentro, porque não depende de nada que o cliente
 * saiba — e assim aparece na primeira pintura, junto do resto da página.
 */
export function TradeBinderSummary({ cards, copies }: { cards: number; copies: number }) {
  if (cards === 0) return null

  return (
    <p className="text-sm text-text-muted">
      {cards === 1 ? '1 carta' : `${cards} cartas`} · {copies === 1 ? '1 cópia' : `${copies} cópias`}{' '}
      disponíveis para troca. Estar aqui não reserva nada:{' '}
      <Link href="/binders" className="font-medium text-accent-ink underline underline-offset-2">
        os binders de troca
      </Link>{' '}
      é que definem o que entra.
    </p>
  )
}
