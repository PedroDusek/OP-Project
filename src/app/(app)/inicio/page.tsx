import type { Metadata } from 'next'
import { Layers } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { EmptyState } from '@/components/ui/states'

export const metadata: Metadata = { title: 'Início' }

/**
 * Home.
 *
 * O dashboard da secao 7 do documento oficial — metricas, valor estimado,
 * progresso por set e ultimas adicoes — depende de casos de uso de colecao que
 * ainda nao existem. Ate la, a tela mostra o estado vazio de verdade: uma conta
 * nova tem a colecao vazia, e a secao 17 pede que o vazio explique o vazio e
 * aponte a proxima acao. Numeros inventados aqui seriam pior que nada.
 */
export default function InicioPage() {
  return (
    <>
      <PageHeader title="Início" description="Sua coleção em um só lugar." />
      <EmptyState
        icon={<Layers className="size-10" aria-hidden />}
        title="Sua coleção está vazia"
        description="Adicione cartas pelo catálogo para acompanhar aqui o total, o progresso por set e o valor estimado."
        action={{ label: 'Abrir o catálogo', href: '/catalogo' }}
      />
    </>
  )
}
