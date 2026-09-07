'use client'

import { useMemo, useState } from 'react'
import { CircleCheck } from 'lucide-react'
import { CardArt } from '@/components/catalog/card-art'
import { ProgressBar } from '@/components/ui/progress-bar'
import { SearchBar } from '@/components/ui/search-bar'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState } from '@/components/ui/states'
import { Panel } from '@/components/ui/surface'
import { PLAYSET_SIZE } from '@/server/domain/collection/counting'
import type { PlaysetRow } from '@/server/application/collection'
import { cn } from '@/lib/cn'

/**
 * Playsets (tela 19).
 *
 * A barra usa `value` e `total` em vez de porcentagem: o leitor de tela anuncia
 * "3 de 4", que é a informação — e uma carta a que faltam duas cópias não deve
 * soar igual a uma a que falta uma.
 *
 * Passar de quatro cópias não passa de 100%: o playset é binário por carta
 * (`business-rules.md` 2.1), e uma barra em 250% diria que existe algo a mais
 * para alcançar.
 */
export function PlaysetList({ rows }: { rows: PlaysetRow[] }) {
  const [scope, setScope] = useState<'all' | 'closed' | 'open'>('all')
  const [term, setTerm] = useState('')

  const counts = useMemo(
    () => ({
      all: rows.length,
      closed: rows.filter((row) => row.closed).length,
      open: rows.filter((row) => !row.closed).length,
    }),
    [rows],
  )

  const matches = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return rows.filter((row) => {
      if (scope === 'closed' && !row.closed) return false
      if (scope === 'open' && row.closed) return false
      if (!needle) return true
      return (
        row.cardCode.toLowerCase().includes(needle) || row.cardName.toLowerCase().includes(needle)
      )
    })
  }, [rows, scope, term])

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Recorte dos playsets"
        value={scope}
        onValueChange={setScope}
        options={[
          { value: 'all', label: 'Todos', count: counts.all },
          { value: 'closed', label: 'Completos', count: counts.closed },
          { value: 'open', label: 'Incompletos', count: counts.open },
        ]}
      />

      <SearchBar
        label="Buscar nos playsets"
        value={term}
        onValueChange={setTerm}
        placeholder="Buscar por código ou nome..."
      />

      {matches.length === 0 ? (
        <EmptyState title="Nada neste recorte" description="Ajuste a busca ou a aba." />
      ) : (
        <ul className="flex flex-col gap-2">
          {matches.map((row) => (
            <li key={row.cardCode}>
              <Panel className="flex items-center gap-3 p-3">
                <CardArt
                  src={row.imageUrl}
                  alt=""
                  fallback={row.cardCode}
                  sizes="44px"
                  className="w-11 shrink-0 rounded-md"
                />

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate text-sm font-semibold text-text tabular-nums">
                    {row.cardCode}
                  </p>
                  <p className="truncate text-xs text-text-muted">{row.cardName}</p>
                  <ProgressBar
                    label={`Playset de ${row.cardCode}`}
                    value={Math.min(row.quantity, PLAYSET_SIZE)}
                    total={PLAYSET_SIZE}
                    className="mt-0.5"
                  />
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      row.closed ? 'text-success' : 'text-text',
                    )}
                  >
                    {row.quantity}
                    <span className="text-text-subtle">/{PLAYSET_SIZE}</span>
                  </span>
                  {row.closed ? (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <CircleCheck className="size-3.5" aria-hidden />
                      Completo
                    </span>
                  ) : null}
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
