import type { Metadata } from 'next'
import { Layers } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { EmptyState } from '@/components/ui/states'

export const metadata: Metadata = { title: 'Coleção' }

/**
 * Minha Coleção.
 *
 * A grade, os filtros, os playsets e a edicao de quantidade chegam com os casos
 * de uso de colecao. O vazio aqui e o vazio real de uma conta nova.
 */
export default function ColecaoPage() {
  return (
    <>
      <PageHeader title="Minha Coleção" description="Suas cartas, com busca, filtros e playsets." />
      <EmptyState
        icon={<Layers className="size-10" aria-hidden />}
        title="Nenhuma carta ainda"
        description="Tudo o que você adicionar aparece aqui, com quantidade, playsets e onde cada cópia está guardada."
        action={{ label: 'Abrir o catálogo', href: '/catalogo' }}
      />
    </>
  )
}
