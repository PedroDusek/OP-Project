'use client'

import { useMemo, useState } from 'react'
import { Heart } from 'lucide-react'
import { CardArt } from '@/components/catalog/card-art'
import { CardGrid } from '@/components/catalog/card-tile'
import { SearchBar } from '@/components/ui/search-bar'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState } from '@/components/ui/states'
import { WantSheet } from './want-sheet'
import type { WantView } from '@/server/application/wants'
import { cn } from '@/lib/cn'

/**
 * A want list (tela 29).
 *
 * Cada carta mostra **possuídas sobre desejadas** — `0/1`, `2/4` —, que é a
 * pergunta que a lista responde: o que ainda falta. Só o número desejado diria
 * quanto se quer sem dizer quanto falta, e é o que falta que faz alguém sair
 * de casa atrás da carta.
 *
 * Tocar numa carta edita a quantidade desejada, como na coleção tocar edita a
 * possuída: numa lista de desejos, a pergunta seguinte é sempre "quantas".
 *
 * A busca filtra no cliente. A want list é uma lista de dezenas, não de
 * milhares — e uma ida ao servidor a cada tecla seria mais lenta que o filtro.
 */
export function WantList({ wants }: { wants: WantView[] }) {
  const [scope, setScope] = useState<'all' | 'missing'>('all')
  const [term, setTerm] = useState('')
  const [editing, setEditing] = useState<WantView | null>(null)

  const counts = useMemo(
    () => ({
      all: wants.length,
      missing: wants.filter((want) => want.status !== 'satisfied').length,
    }),
    [wants],
  )

  const shown = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return wants.filter((want) => {
      if (scope === 'missing' && want.status === 'satisfied') return false
      if (!needle) return true
      return (
        want.cardCode.toLowerCase().includes(needle) ||
        want.cardName.toLowerCase().includes(needle)
      )
    })
  }, [wants, scope, term])

  if (wants.length === 0) {
    return (
      <EmptyState
        icon={<Heart className="size-10" aria-hidden />}
        title="Sua want list está vazia"
        description="Abra uma carta no catálogo e diga que você a quer. Ela aparece aqui."
        action={{ label: 'Abrir o catálogo', href: '/catalogo' }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SearchBar
        label="Buscar na want list"
        value={term}
        onValueChange={setTerm}
        placeholder="Buscar por código ou nome..."
      />

      <Segmented
        label="Recorte da want list"
        value={scope}
        onValueChange={setScope}
        options={[
          { value: 'all', label: 'Todas', count: counts.all },
          { value: 'missing', label: 'Ainda faltam', count: counts.missing },
        ]}
      />

      {shown.length === 0 ? (
        <EmptyState title="Nada neste recorte" description="Ajuste a busca ou a aba." />
      ) : (
        <CardGrid>
          {shown.map((want, index) => (
            <button
              key={want.variantId}
              type="button"
              onClick={() => setEditing(want)}
              className="flex flex-col gap-1.5 text-left"
            >
              <span className="relative block">
                <CardArt
                  src={want.imageUrl}
                  alt={`${want.cardCode} — ${want.cardName}`}
                  fallback={want.cardCode}
                  priority={index < 3}
                  className={cn(want.status === 'satisfied' && 'opacity-55')}
                />
                <span
                  className={cn(
                    'absolute right-1 bottom-1 rounded-md px-1.5 py-0.5',
                    'text-xs font-bold tabular-nums text-white',
                    want.status === 'satisfied' ? 'bg-success/90' : 'bg-black/75',
                  )}
                >
                  {want.owned}/{want.wanted}
                </span>
              </span>

              <span className="flex flex-col gap-0.5">
                <span className="truncate text-xs font-semibold text-text tabular-nums">
                  {want.cardCode}
                </span>
                <span className="truncate text-xs text-text-muted">{want.cardName}</span>
              </span>
            </button>
          ))}
        </CardGrid>
      )}

      {editing ? (
        <WantSheet
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          variantId={editing.variantId}
          code={editing.cardCode}
          name={editing.cardName}
          imageUrl={editing.imageUrl}
          labels={labelsFor(editing)}
          currentQuantity={editing.wanted}
          owned={editing.owned}
        />
      ) : null}
    </div>
  )
}

/** Raridade sempre; variante só quando não é Normal, que é o caso comum. */
function labelsFor(want: WantView): string[] {
  const labels: string[] = []
  if (want.rarity) labels.push(want.rarity)
  if (want.variantType !== 'Normal') labels.push(want.variantType)
  return labels
}
