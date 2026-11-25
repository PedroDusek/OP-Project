'use client'

import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { SetBadge } from '@/components/catalog/set-badge'
import { SetCover } from '@/components/catalog/set-cover'
import { ProgressBar } from '@/components/ui/progress-bar'
import { SearchBar } from '@/components/ui/search-bar'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState } from '@/components/ui/states'
import { Panel } from '@/components/ui/surface'
import { SET_KIND_LABEL, type SetKind } from '@/server/domain/catalog/sets'
import type { PlaysetSetSummary } from '@/server/application/collection'

/**
 * As coleções, com quantos playsets cada uma tem fechados (decisão 114).
 *
 * É a porta da aba: escolha do dono do produto, e não só arranjo de tela. O
 * universo de playset são 2.816 cartas, e "faltam" sem recorte seria uma lista
 * de milhares de linhas que não responde nada. Por coleção, são algumas
 * centenas — e a conta de cada uma cabe na cabeça.
 *
 * Irmã da `SetList` do catálogo de propósito: a mesma gestualidade, com o
 * número que esta tela existe para dizer no lugar da contagem de cartas. A
 * busca é local pelo mesmo motivo de lá — são algumas dezenas de itens que já
 * vieram inteiros.
 *
 * **A coleção dos DON!! não aparece**, e não há caso especial aqui: nenhuma
 * carta dela conta playset (decisão 112), então ela chega sem nenhuma carta no
 * universo e o caso de uso não a devolve.
 */
export function PlaysetSetList({ sets }: { sets: PlaysetSetSummary[] }) {
  const [kind, setKind] = useState<SetKind>('collection')
  const [term, setTerm] = useState('')

  const counts = useMemo(() => {
    const tally: Record<SetKind, number> = { collection: 0, deck: 0, promo: 0, don: 0 }
    for (const set of sets) tally[set.kind] += 1
    return tally
  }, [sets])

  const matches = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return sets.filter((set) => {
      if (set.kind !== kind) return false
      if (!needle) return true
      return (
        set.code.toLowerCase().includes(needle) || set.displayName.toLowerCase().includes(needle)
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
        label="Buscar coleções"
        value={term}
        onValueChange={setTerm}
        placeholder="Buscar por código ou nome..."
      />

      {matches.length === 0 ? (
        <EmptyState
          title="Nenhuma coleção encontrada"
          description={term ? `Nada corresponde a "${term}".` : 'Nada nesta categoria.'}
        />
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {matches.map((set) => (
            <li key={set.code}>
              <Panel className="overflow-hidden transition-colors hover:bg-surface-muted">
                <Link
                  href={`/playsets/${encodeURIComponent(set.code)}`}
                  className="flex items-center gap-3 p-3"
                >
                  {/* O nome está ao lado: a imagem não repete no leitor de tela. */}
                  <SetCover
                    code={set.code}
                    alt=""
                    sizes="56px"
                    className="w-14"
                    fallback={<SetBadge code={set.displayCode} />}
                  />

                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm font-semibold text-text">
                      {set.displayName}
                    </span>
                    <span className="text-xs text-text-muted tabular-nums">
                      {set.displayCode} · {set.closed} de {set.total} playsets
                    </span>
                    {/*
                      `value` e `total`, e nao a porcentagem: o leitor de tela
                      anuncia "12 de 120", que e a informacao — e 12 de 120 nao
                      deve soar igual a 1 de 10.
                    */}
                    <ProgressBar
                      label={`Playsets de ${set.displayCode}`}
                      value={set.closed}
                      total={set.total}
                      className="mt-0.5"
                    />
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
