'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Segmented } from '@/components/ui/segmented'
import { buildCatalogHref } from '@/lib/catalog-params'

/**
 * As abas da coleção: todas, playsets fechados, e o que falta.
 *
 * Escreve na URL como o resto das listagens, para o recorte ser compartilhável
 * e voltar igual pelo histórico.
 */
export function CollectionScope({
  counts,
}: {
  counts: { all: number; playsets: number; incomplete: number }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [, start] = useTransition()

  const value = params.get('recorte') ?? 'all'

  return (
    <Segmented
      label="Recorte da coleção"
      value={value}
      onValueChange={(next) =>
        start(() => {
          router.push(
            buildCatalogHref(pathname, params, { recorte: next === 'all' ? undefined : next }),
            { scroll: false },
          )
        })
      }
      options={[
        { value: 'all', label: 'Todas', count: counts.all },
        { value: 'playsets', label: 'Playsets', count: counts.playsets },
        { value: 'incomplete', label: 'Faltam', count: counts.incomplete },
      ]}
    />
  )
}
