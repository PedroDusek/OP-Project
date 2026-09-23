'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpDown } from 'lucide-react'
import { Select } from '@/components/ui/select'
import {
  CATALOG_SORT_LABELS,
  CATALOG_SORTS,
  DEFAULT_CATALOG_SORT,
  parseCatalogSort,
} from '@/server/domain/catalog/order'
import { buildCatalogHref, PARAM, type CatalogSearchParams } from '@/lib/catalog-params'

/**
 * A escolha da ordem da listagem (decisão 110).
 *
 * ## Por que fora do painel de filtros
 *
 * Ela morava dentro do painel, e o dono do produto pediu para tirá-la de lá
 * (23/09). O motivo vale registrar: **ordenar não é filtrar**. O painel é uma
 * pergunta que se monta e se aplica de uma vez, com Limpar e um distintivo de
 * quantos filtros estão ativos — e a ordem não pertence a nenhuma dessas três
 * coisas. Fora dele, ela também fica visível sem abrir nada, que é o gesto que
 * se repete: filtrar uma vez e reordenar várias.
 *
 * A consequência que o pedido exigia: **mexer nos filtros não mexe na ordem**.
 * Na URL isso sai de graça, porque `buildCatalogHref` preserva o que não foi
 * citado. Nas telas que guardam os filtros em estado local, o painel devolve um
 * objeto que substitui o anterior inteiro — então ele carrega a ordem junto, sem
 * tocar nela. Ver o comentário no `apply` de `catalog-filters.tsx`.
 *
 * ## Dois destinos, como no painel
 *
 * Por padrão a escolha vai para a URL. Com `onChange`, volta para quem chamou —
 * é o que o Deck Builder e o seletor de cartas precisam, onde os filtros são
 * passo de uma tarefa e navegar apagaria o que já foi escolhido.
 */
export interface CatalogSortProps {
  /** Recebe a escolha em vez de navegar. Exige `values`. */
  onChange?: (changes: CatalogSearchParams) => void
  /** Os filtros atuais, quando não vêm da URL. */
  values?: CatalogSearchParams
}

export function CatalogSort({ onChange, values }: CatalogSortProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [, startTransition] = useTransition()

  const atual = parseCatalogSort(
    values ? first(values[PARAM.ordem]) : (params.get(PARAM.ordem) ?? undefined),
  )

  const escolher = (value: string) => {
    // A ordem padrão sai da URL em vez de ir escrita nela: `?ordem=codigo` diz
    // o mesmo que não dizer nada, e um endereço compartilhado fica mais limpo.
    const ordem = value === DEFAULT_CATALOG_SORT ? undefined : value

    if (onChange) {
      // Substitui o objeto inteiro, como o painel faz — por isso o resto dos
      // filtros vai junto, e não só a ordem.
      onChange({ ...values, [PARAM.ordem]: ordem })
      return
    }

    startTransition(() => {
      router.push(buildCatalogHref(pathname, params, { [PARAM.ordem]: ordem }), { scroll: false })
    })
  }

  return (
    <div className="flex items-center gap-3">
      <ArrowUpDown className="size-5 shrink-0 text-text-muted" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-medium text-text-muted">Ordenar por</p>
        <Select
          label="Ordenar por"
          value={atual}
          onValueChange={escolher}
          options={CATALOG_SORTS.map((option) => ({
            value: option,
            label: CATALOG_SORT_LABELS[option],
          }))}
        />
      </div>
    </div>
  )
}

/** O filtro chega como valor único ou lista; aqui só o primeiro interessa. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
