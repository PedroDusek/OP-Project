'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { FilterSection, FilterSheet } from '@/components/ui/filter-sheet'
import { Select } from '@/components/ui/select'

/**
 * Os filtros do dashboard: coleção, raridade e cor (decisão 098, escolha do dono
 * do produto).
 *
 * **Uma linha só**: a coleção à vista, e raridade e cor no mesmo painel em folha
 * do catálogo. Pedido do dono do produto — com as fileiras de botões abertas, os
 * números só apareciam depois de rolar a tela.
 *
 * Vivem na URL, e não em estado: o dashboard é desenhado no servidor, e o
 * endereço filtrado pode ser guardado ou mandado para alguém.
 */

const TODAS = '*'

export function DashboardFilters({
  sets,
  rarities,
  colors,
}: {
  sets: { code: string; label: string }[]
  rarities: string[]
  colors: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const colecao = params.get('colecao') ?? undefined
  const raridades = params.getAll('raridade')
  const cores = params.getAll('cor')

  const [aberto, setAberto] = useState(false)
  const [rascunhoRaridades, setRascunhoRaridades] = useState<string[]>(raridades)
  const [rascunhoCores, setRascunhoCores] = useState<string[]>(cores)

  const navegar = (novos: URLSearchParams) => {
    const texto = novos.toString()
    startTransition(() => router.replace(texto ? `${pathname}?${texto}` : pathname, { scroll: false }))
  }

  const abrir = () => {
    // O painel abre com o que esta valendo, e nao com o rascunho abandonado.
    setRascunhoRaridades(raridades)
    setRascunhoCores(cores)
    setAberto(true)
  }

  const aplicar = (novasRaridades: string[], novasCores: string[]) => {
    const novos = new URLSearchParams(params.toString())
    novos.delete('raridade')
    novos.delete('cor')
    for (const r of novasRaridades) novos.append('raridade', r)
    for (const c of novasCores) novos.append('cor', c)
    navegar(novos)
    setAberto(false)
  }

  const alternar = (lista: string[], valor: string) =>
    lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]

  const ativos = raridades.length + cores.length

  return (
    <div className="flex items-center gap-2" aria-busy={pending}>
      <Select
        label="Coleção"
        className="min-w-0 flex-1"
        value={colecao ?? TODAS}
        onValueChange={(valor) => {
          const novos = new URLSearchParams(params.toString())
          if (valor === TODAS) novos.delete('colecao')
          else novos.set('colecao', valor)
          navegar(novos)
        }}
        options={[{ value: TODAS, label: 'Todas as coleções' }, ...sets.map((set) => ({ value: set.code, label: set.label }))]}
      />

      <Button variant="secondary" onClick={abrir} aria-label={`Filtros${ativos ? `, ${ativos} ativos` : ''}`}>
        <SlidersHorizontal className="size-4" aria-hidden />
        Filtros{ativos ? ` (${ativos})` : ''}
      </Button>

      <FilterSheet
        open={aberto}
        onOpenChange={setAberto}
        title="Filtrar os números"
        activeCount={rascunhoRaridades.length + rascunhoCores.length}
        onApply={() => aplicar(rascunhoRaridades, rascunhoCores)}
        onClear={() => aplicar([], [])}
      >
        <FilterSection title="Raridade">
          <div className="flex flex-wrap gap-1.5">
            {rarities.map((raridade) => (
              <Chip
                key={raridade}
                selected={rascunhoRaridades.includes(raridade)}
                onClick={() => setRascunhoRaridades((atual) => alternar(atual, raridade))}
              >
                {raridade}
              </Chip>
            ))}
          </div>
        </FilterSection>
        <FilterSection title="Cor">
          <div className="flex flex-wrap gap-1.5">
            {colors.map((cor) => (
              <Chip
                key={cor}
                selected={rascunhoCores.includes(cor)}
                onClick={() => setRascunhoCores((atual) => alternar(atual, cor))}
              >
                {cor}
              </Chip>
            ))}
          </div>
        </FilterSection>
      </FilterSheet>
    </div>
  )
}
