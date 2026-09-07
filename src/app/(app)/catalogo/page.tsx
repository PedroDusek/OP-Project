import type { Metadata } from 'next'
import { Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { EmptyState } from '@/components/ui/states'

export const metadata: Metadata = { title: 'Catálogo' }

/**
 * Catálogo.
 *
 * Diferente de Início e Coleção, aqui **nao** cabe um estado vazio: o catálogo
 * tem 2.785 cartas importadas, e dizer que está vazio seria falso. A tela
 * anuncia o que falta, que é a listagem.
 */
export default function CatalogoPage() {
  return (
    <>
      <PageHeader
        title="Catálogo"
        description="Explore todas as cartas do One Piece Card Game."
      />
      <EmptyState
        icon={<Search className="size-10" aria-hidden />}
        title="Listagem em preparação"
        description="A busca, os sets e a grade de cartas entram na próxima etapa. O catálogo já está importado e a API de busca já responde."
      />
    </>
  )
}
