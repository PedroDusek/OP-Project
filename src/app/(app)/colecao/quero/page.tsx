import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/app-shell'
import { CollectionTabs } from '@/components/collection/collection-tabs'
import { WantList } from '@/components/wants/want-list'
import { getWantSummary, listWants } from '@/server/application/wants'
import { getCollectionSummary } from '@/server/application/collection'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Want list' }

/**
 * Minha want list (tela 29).
 *
 * Mora dentro da Coleção, e não dentro de Trocas: a want list é a coleção pelo
 * avesso — o que falta —, e quem a abre está pensando na própria coleção. Foi a
 * escolha do dono do produto.
 *
 * Ela não depende de preço nem de trade: um want é variante e quantidade
 * (`business-rules.md` 4.4). É por isso que dá para construí-la agora, enquanto
 * a valoração espera a fonte de preço.
 */
export default async function QueroPage() {
  const viewer = await requireViewer('/colecao/quero')

  const [wants, summary, collection] = await Promise.all([
    listWants(viewer),
    getWantSummary(viewer),
    getCollectionSummary(viewer),
  ])

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
        <CollectionTabs
          counts={{ '/colecao': collection.uniqueVariants, '/colecao/quero': summary.variants }}
        />
        <WantList wants={wants} />
      </div>
    </>
  )
}
