import type { Metadata } from 'next'
import { ArrowLeftRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { EmptyState } from '@/components/ui/states'

export const metadata: Metadata = { title: 'Trocas' }

/**
 * Trocas: want list, Trade Binder, matches e negociações.
 */
export default function TrocasPage() {
  return (
    <>
      <PageHeader
        title="Trocas"
        description="Want list, Trade Binder, matches e negociações."
      />
      <EmptyState
        icon={<ArrowLeftRight className="size-10" aria-hidden />}
        title="Nada em negociação"
        description="Marque as cartas que você quer e as que estão disponíveis para troca, e o ColeXa encontra quem tem o que falta na sua coleção."
      />
    </>
  )
}
