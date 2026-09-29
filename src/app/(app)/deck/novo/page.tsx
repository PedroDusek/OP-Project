import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/app-shell'
import { DeckBuilder } from '@/components/decks/deck-builder'
import { PremiumNotice } from '@/components/premium/premium-notice'
import { isPremium } from '@/server/application/authorization'
import { getCatalogVocabulary, searchCatalog } from '@/server/application/catalog'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Nova decklist' }

/**
 * Montar uma decklist nova (decisão 108).
 *
 * O builder é o mesmo de sempre — as regras, a conferência e o que falta não
 * mudaram (decisão 095). O que ele ganhou foi o fim: dar um nome e salvar.
 *
 * Recurso Premium, como o resto da análise da coleção (decisão 093). O caso de
 * uso recusa de novo, para quem chegar por outro caminho.
 */
export default async function NovaDecklistPage() {
  const viewer = await requireViewer('/deck/novo')
  const premium = isPremium(viewer)

  // A primeira leva de lideres vem do servidor, como no seletor de cartas: a
  // regra de lint do projeto proibe buscar dentro de um efeito.
  const [lideres, vocabulary] = premium
    ? await Promise.all([searchCatalog({ type: ['Leader'], pageSize: 12 }), getCatalogVocabulary()])
    : [null, null]

  return (
    <>
      <PageHeader
        back={{ href: '/deck', label: 'as decklists' }}
        title="Nova decklist"
        description="Escolha o líder, monte a lista e veja o que você já tem, onde está e quanto custa o que falta."
      />

      {lideres && vocabulary ? (
        <DeckBuilder
          vocabulary={vocabulary}
          initialLeaders={lideres.items.map((item) => ({
            variantId: String(item.variantId),
            cardCode: item.cardCode,
            cardName: item.cardName,
            variantType: item.variantType,
            imageUrl: item.imageUrl,
          }))}
        />
      ) : (
        <PremiumNotice
          title="As decklists são Premium"
          description="Com o Premium, você monta um deck de 50 cartas, salva a lista e o ColeXa diz quais cartas você já tem, em qual binder ou caixa elas estão, e quanto custaria comprar o que falta."
        />
      )}
    </>
  )
}
