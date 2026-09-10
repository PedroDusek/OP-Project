import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { WantBulkAdd } from '@/components/wants/want-bulk-add'
import { getCatalogVocabulary, searchCatalog } from '@/server/application/catalog'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Adicionar à want list' }

/**
 * Acrescentar cartas à want list em massa.
 *
 * Percorrer o catálogo marcando o que falta é uma tarefa de dezenas de cartas —
 * anotar o que se procura depois de ver a lista de uma coleção nova. Fazer isso
 * carta a carta, entrando em cada uma, é o tipo de atrito que faz a lista não
 * ser mantida.
 *
 * A primeira leva de cartas é renderizada aqui, e não buscada ao montar: sem
 * isso a tela abre vazia e depende do JavaScript para mostrar qualquer coisa.
 */
export default async function AdicionarWantPage() {
  await requireViewer('/colecao/quero/adicionar')

  const [vocabulary, primeira] = await Promise.all([
    getCatalogVocabulary(),
    searchCatalog({ pageSize: 24 }),
  ])

  return (
    <>
      <div className="flex items-start gap-3 pb-4">
        <Link
          href="/colecao/quero"
          aria-label="Voltar para a want list"
          className="-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-muted"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1 pt-2">
          <h1 className="truncate text-2xl font-bold tracking-tight text-text">
            Adicionar à want list
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Escolha quantas cópias de cada carta você procura. Nada entra na sua coleção.
          </p>
        </div>
      </div>

      <WantBulkAdd
        vocabulary={vocabulary}
        initialTotal={primeira.total}
        initialCards={primeira.items.map((item) => ({
          // `bigint` vira string na fronteira: JSON não serializa BigInt.
          variantId: String(item.variantId),
          cardCode: item.cardCode,
          cardName: item.cardName,
          rarity: item.rarity,
          variantType: item.variantType,
          imageUrl: item.imageUrl,
        }))}
      />
    </>
  )
}
