'use client'

import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { CardArt } from '@/components/catalog/card-art'
import { SearchBar } from '@/components/ui/search-bar'
import { Segmented } from '@/components/ui/segmented'
import { Panel } from '@/components/ui/surface'
import { EmptyState } from '@/components/ui/states'
import { cardCountLabel, SET_KIND_LABEL, type SetKind } from '@/server/domain/catalog/sets'
import type { SetSummary } from '@/server/application/catalog/list-sets'

/**
 * Sets, separados por tipo, com busca.
 *
 * Coleções e decks convivem no mesmo catálogo e são coisas diferentes de
 * procurar: quem quer saber o que falta de OP-13 não quer 36 decks iniciantes no
 * meio do caminho. A separação foi pedida pelo dono do produto e a classificação
 * está em `src/server/domain/catalog/sets.ts`.
 *
 * As coleções aparecem **em ordem de lançamento**, não alfabética nem por
 * código: é a ordem em que a pessoa viveu o jogo, e é a única em que os extra
 * boosters caem no lugar certo entre os boosters.
 *
 * A busca é local e não passa pela URL nem pelo servidor, ao contrário da busca
 * de cartas. São 60 itens que já vieram inteiros: filtrar em memória responde na
 * tecla, e uma ida ao servidor por letra digitada seria trabalho para chegar
 * mais devagar ao mesmo lugar.
 */
export function SetList({ sets, initialKind = 'collection' }: { sets: SetSummary[]; initialKind?: SetKind }) {
  const [kind, setKind] = useState<SetKind>(initialKind)
  const [term, setTerm] = useState('')

  const counts = useMemo(() => {
    const tally: Record<SetKind, number> = { collection: 0, deck: 0, promo: 0 }
    for (const set of sets) tally[set.kind] += 1
    return tally
  }, [sets])

  const matches = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return sets.filter((set) => {
      if (set.kind !== kind) return false
      if (!needle) return true
      return (
        set.code.toLowerCase().includes(needle) ||
        set.displayName.toLowerCase().includes(needle) ||
        // Casa também com o nome como a fonte publicou, com hifens e tudo.
        set.name.toLowerCase().includes(needle)
      )
    })
  }, [sets, kind, term])

  const options = (['collection', 'deck', 'promo'] as const)
    .filter((value) => counts[value] > 0)
    .map((value) => ({ value, label: SET_KIND_LABEL[value], count: counts[value] }))

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Tipo de set"
        options={options}
        value={kind}
        onValueChange={(value) => setKind(value)}
      />

      <SearchBar
        label="Buscar sets"
        value={term}
        onValueChange={setTerm}
        placeholder="Buscar por código ou nome..."
      />

      {matches.length === 0 ? (
        <EmptyState
          title="Nenhum set encontrado"
          description={term ? `Nada corresponde a "${term}".` : 'Nada nesta categoria.'}
        />
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {matches.map((set) => (
            <li key={set.code}>
              <Panel className="overflow-hidden transition-colors hover:bg-surface-muted">
                <Link
                  href={`/catalogo/sets/${encodeURIComponent(set.code)}`}
                  className="flex items-center gap-3 p-3"
                >
                  <CardArt
                    src={set.coverUrl}
                    alt=""
                    fallback={set.displayCode}
                    sizes="44px"
                    className="w-11 shrink-0 rounded-md"
                  />

                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-text">
                      {set.displayName}
                    </span>
                    <span className="text-xs text-text-muted tabular-nums">
                      {set.displayCode} · {cardCountLabel(set.variantCount)}
                    </span>
                  </span>

                  <ChevronRight className="size-4 shrink-0 text-text-subtle" aria-hidden />
                </Link>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
