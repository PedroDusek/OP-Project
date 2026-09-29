'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Segmented } from '@/components/ui/segmented'
import { buildCatalogHref } from '@/lib/catalog-params'
import { DECKS_TABS, DEFAULT_DECKS_TAB, parseDecksTab, type DecksTab } from '@/lib/decks-tabs'

/**
 * As duas gavetas de Decks: as deckboxes e as decklists (decisão 111).
 *
 * Escreve na URL como o resto das abas do app, para o recorte ser
 * compartilhável e voltar igual pelo histórico — é o mesmo desenho do recorte
 * da coleção.
 */
export function DecksTabs({ counts }: { counts: Record<DecksTab, number> }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [, start] = useTransition()

  const value = parseDecksTab(params.get('aba'))

  return (
    <Segmented
      label="O que ver em Decks"
      value={value}
      onValueChange={(next) =>
        start(() => {
          router.push(
            // A aba padrão sai da URL: `?aba=deckbox` diz o mesmo que não dizer nada.
            buildCatalogHref(pathname, params, {
              aba: next === DEFAULT_DECKS_TAB ? undefined : next,
            }),
            { scroll: false },
          )
        })
      }
      options={DECKS_TABS.map((tab) => ({
        value: tab,
        label: tab === 'deckbox' ? 'Deckboxes' : 'Decklists',
        count: counts[tab],
      }))}
    />
  )
}
