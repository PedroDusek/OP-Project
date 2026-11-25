import type { Metadata } from 'next'
import { Star } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { PlaysetSetList } from '@/components/collection/playset-set-list'
import { PremiumNotice } from '@/components/premium/premium-notice'
import { EmptyState } from '@/components/ui/states'
import { isPremium } from '@/server/application/authorization'
import { listPlaysetSets } from '@/server/application/collection'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Playsets' }

/**
 * Playsets (decisão 114).
 *
 * Era a tela 19, dentro da coleção, e saía de `collection_items`: só conhecia as
 * cartas que a pessoa tinha, e por isso nunca podia mostrar `0/4`. Agora é
 * destino próprio, entre Binders e Decks, e o universo é o **catálogo** — que é
 * a pergunta de quem monta coleção: de tudo que existe, o que eu já fechei.
 *
 * ## Por que a porta é uma lista de coleções
 *
 * São 2.816 cartas no universo. Sem recorte, "faltam" seria uma lista de
 * milhares de linhas que não responde nada; por coleção, são algumas centenas.
 * Escolha do dono do produto, e também o que mantém a consulta barata.
 *
 * ## Premium, com a porta à vista
 *
 * A análise da coleção é Premium (decisão 093) e esta tela é inteira dela.
 * Ainda assim a aba aparece na gaveta para o Free, e quem entra encontra o
 * convite em vez de uma porta fechada: escolha do dono do produto em 25/11. É o
 * lugar onde o Premium interessa — esconder a aba esconderia que ela existe.
 */
export default async function PlaysetsPage() {
  const viewer = await requireViewer('/playsets')

  if (!isPremium(viewer)) {
    return (
      <>
        <PageHeader
          back={{ href: '/inicio', label: 'o Início' }}
          title="Playsets"
          description="Quantas cartas já fecharam quatro cópias, coleção por coleção."
        />
        <PremiumNotice
          title="Os playsets são Premium"
          description="Veja, em cada coleção, quantas cartas já fecharam quatro cópias e quais ainda estão em zero — somando todas as artes."
        />
      </>
    )
  }

  const { sets, total, closed } = await listPlaysetSets(viewer)

  return (
    <>
      <PageHeader
        back={{ href: '/inicio', label: 'o Início' }}
        title="Playsets"
        /*
          O total vem contado sobre cartas distintas, e nao somando as colecoes:
          uma carta reimpressa pertence a dois sets, e a soma passaria do que o
          catalogo tem.
        */
        description={`${closed} de ${total} cartas com playset fechado.`}
      />

      {sets.length === 0 ? (
        <EmptyState
          icon={<Star className="size-10" aria-hidden />}
          title="Nenhuma coleção ainda"
          description="O catálogo precisa estar importado para os playsets aparecerem."
          action={{ label: 'Abrir o catálogo', href: '/catalogo' }}
        />
      ) : (
        <PlaysetSetList sets={sets} />
      )}
    </>
  )
}
