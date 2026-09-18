import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/app-shell'
import { DeckBuilder } from '@/components/decks/deck-builder'
import { PremiumNotice } from '@/components/premium/premium-notice'
import { isPremium } from '@/server/application/authorization'
import { getCatalogVocabulary, searchCatalog } from '@/server/application/catalog'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Deck Builder' }

/**
 * Deck Builder (decisão 095).
 *
 * Um líder e cinquenta cartas; o ColeXa diz o que você tem, onde está e quanto
 * custa o que falta. **Nada é guardado**: é conferência, e a lista dura enquanto
 * a tela estiver aberta.
 *
 * Recurso Premium, como o resto da análise da coleção (decisão 093). O caso de
 * uso recusa de novo, para quem chegar por outro caminho.
 */
export default async function DeckPage() {
  const viewer = await requireViewer('/deck')

  // A primeira leva de lideres vem do servidor, como no seletor de cartas: a
  // regra de lint do projeto proibe buscar dentro de um efeito.
  const premium = isPremium(viewer)
  const [lideres, vocabulary] = premium
    ? await Promise.all([searchCatalog({ type: ['Leader'], pageSize: 12 }), getCatalogVocabulary()])
    : [null, null]

  return (
    <>
      <PageHeader back={{ href: '/inicio', label: 'o Início' }}
        title="Deck Builder"
        description="Monte a lista e veja o que você já tem, onde está e quanto custa o que falta."
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
          title="O Deck Builder é Premium"
          description="Com o Premium, você monta um deck de 50 cartas e o ColeXa diz quais você já tem, em qual binder ou caixa elas estão, e quanto custaria comprar o que falta."
        />
      )}
    </>
  )
}
