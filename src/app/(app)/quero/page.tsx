import type { Metadata } from 'next'
import { FileDown, ListPlus } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { ListRow, PanelList } from '@/components/ui/surface'
import { WantList } from '@/components/wants/want-list'
import { getWantSummary, listWants } from '@/server/application/wants'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Want list' }

/**
 * Minha want list (tela 29).
 *
 * Virou destino próprio na navegação (decisão 061). Antes era uma aba da
 * Coleção, porque a barra de cinco não tinha vaga — e a want list é mesmo a
 * coleção pelo avesso. Com a gaveta, a vaga existe, e ela é uma tarefa
 * inteira: anotar o que falta, levar ao grupo, riscar o que conseguiu.
 *
 * As ferramentas ficam aqui, junto da lista, e não numa página de
 * configuração: acrescentar em leva e gerar a folha são o que se faz **com**
 * ela.
 */
export default async function QueroPage() {
  const viewer = await requireViewer('/quero')

  const [wants, summary] = await Promise.all([listWants(viewer), getWantSummary(viewer)])

  return (
    <>
      <PageHeader
        title="Want list"
        description={
          summary.variants === 0
            ? 'As cartas que você quer, em um lugar só.'
            : `${summary.variants} variantes na sua lista · ${summary.remaining} cópias faltando`
        }
      />

      <div className="flex flex-col gap-4">
        <PanelList>
          <ListRow
            href="/quero/adicionar"
            leading={<ListPlus className="size-5 text-text-muted" aria-hidden />}
            title="Adicionar em massa"
            description="Percorra o catálogo com filtros e marque quantas de cada você procura."
          />
          <ListRow
            href="/quero/pdf"
            leading={<FileDown className="size-5 text-text-muted" aria-hidden />}
            title="Baixar a lista"
            description="Uma folha com as cartas que faltam, em imagem ou impressa."
          />
        </PanelList>

        <WantList wants={wants} />
      </div>
    </>
  )
}
