'use client'

import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { SearchBar } from '@/components/ui/search-bar'
import { Panel } from '@/components/ui/surface'
import { EmptyState } from '@/components/ui/states'
import type { SetSummary } from '@/server/application/catalog/list-sets'

/**
 * Os 60 sets, com busca.
 *
 * A busca é local e não passa pela URL nem pelo servidor, ao contrário da busca
 * de cartas. São 60 itens que já vieram inteiros: filtrar em memória responde
 * na tecla, e uma ida ao servidor por letra digitada seria trabalho para chegar
 * mais devagar ao mesmo lugar.
 *
 * Ela casa por código **e** por nome, porque quem procura "romance" e quem
 * procura "OP01" estão procurando a mesma coisa. E casa também no nome como a
 * fonte publicou, para que buscar pelos hifens decorativos ainda encontre.
 */
export function SetList({ sets }: { sets: SetSummary[] }) {
  const [term, setTerm] = useState('')

  const matches = useMemo(() => {
    const needle = term.trim().toLowerCase()
    if (!needle) return sets
    return sets.filter(
      (set) =>
        set.code.toLowerCase().includes(needle) ||
        set.displayName.toLowerCase().includes(needle) ||
        set.name.toLowerCase().includes(needle),
    )
  }, [sets, term])

  return (
    <div className="flex flex-col gap-4">
      <SearchBar
        label="Buscar sets"
        value={term}
        onValueChange={setTerm}
        placeholder="Buscar sets..."
      />

      {matches.length === 0 ? (
        <EmptyState
          title="Nenhum set encontrado"
          description={`Nada corresponde a "${term}".`}
        />
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {matches.map((set) => (
            <li key={set.code}>
              <Panel className="transition-colors hover:bg-surface-muted">
                <Link
                  href={`/catalogo/sets/${encodeURIComponent(set.code)}`}
                  className="flex items-center gap-3 p-3"
                >
                  {/*
                    O código no lugar de uma capa: a seção 19 proíbe arte de
                    franquia como decoração, e o modelo não guarda capa de set.
                    O código é o que a pessoa reconhece de qualquer forma.
                  */}
                  <span
                    aria-hidden
                    className="flex size-12 shrink-0 items-center justify-center rounded-control bg-accent-soft px-1 text-center text-xs font-bold text-accent-ink"
                  >
                    {set.code}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-text">
                      {set.displayName}
                    </span>
                    <span className="text-xs text-text-muted tabular-nums">
                      {set.code} ·{' '}
                      {set.variantCount === 1 ? '1 variante' : `${set.variantCount} variantes`}
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
