import Link from 'next/link'
import { CardArt } from '@/components/catalog/card-art'
import { Badge } from '@/components/ui/badge'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Panel } from '@/components/ui/surface'
// O tipo vem por `import type` e some na compilação; a constante vem do
// **domínio**, que é puro. O índice de `application` traria o Prisma junto, e
// componente não atravessa essa fronteira.
import type { SavedDeckSummary } from '@/server/application/decks/saved-decks'
import { DECK_TOTAL_WITH_LEADER } from '@/server/domain/decks/deck'

/**
 * As decklists salvas (decisão 108).
 *
 * ## A capa é o líder
 *
 * Escolha do dono do produto, e ela se paga: o líder é o que identifica um deck
 * para quem joga — "o Luffy vermelho" diz mais que qualquer nome. Por isso a
 * arte dele é a capa, e não há campo de imagem para preencher.
 *
 * ## Dois números, e eles respondem perguntas diferentes
 *
 * **A barra** é quantas cartas a pessoa **já tem**, contando qualquer arte da
 * mesma carta — responde "consigo jogar isto?". A marca **incompleta** é sobre a
 * lista, e não sobre a coleção: ela diz que faltam cartas para fechar as
 * cinquenta. Uma lista pode estar completa e a pessoa não ter nenhuma carta, e
 * vice-versa.
 *
 * A barra é a mesma dos playsets e do progresso de set (pedido do dono do
 * produto em 22/09, por estética): o texto solto destoava de um produto que já
 * desenha progresso em três telas.
 */
export function DeckList({ decks, premium }: { decks: SavedDeckSummary[]; premium: boolean }) {
  return (
    <ul className="flex flex-col gap-2">
      {decks.map((deck) => (
        <li key={deck.id}>
          <DeckRow deck={deck} premium={premium} />
        </li>
      ))}
    </ul>
  )
}

function DeckRow({ deck, premium }: { deck: SavedDeckSummary; premium: boolean }) {
  const conteudo = (
    <Panel className="flex items-center gap-3 p-3">
      <CardArt
        src={deck.leader.imageUrl}
        alt=""
        fallback={deck.leader.cardCode}
        sizes="56px"
        className="w-14 shrink-0"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-sm font-semibold text-text">{deck.name}</p>
        <p className="truncate text-xs text-text-muted">{deck.leader.cardName}</p>
        {/*
          A mesma barra dos playsets e do progresso de set: quantas das 51 a
          pessoa já tem. Ela recebe valor e total, e não uma porcentagem pronta —
          é o que faz o leitor de tela anunciar "42 de 51", e o que impede
          42/51 e 84/102 de virarem o mesmo "82%".
        */}
        <ProgressBar
          label={`${deck.owned} de ${DECK_TOTAL_WITH_LEADER} cartas de ${deck.name}`}
          value={deck.owned}
          total={DECK_TOTAL_WITH_LEADER}
          showNumbers
          className="mt-0.5"
        />
      </div>
      {deck.incomplete ? (
        <Badge tone="warning">Incompleta</Badge>
      ) : null}
    </Panel>
  )

  /*
   * Sem Premium a lista aparece e não abre (escolha do dono do produto em
   * 22/09). Um link que leva a uma tela de recusa seria pior que nenhum: a
   * pessoa clica, perde o lugar e volta. A marca diz o motivo onde ela está.
   */
  if (!premium) {
    return (
      <div className="relative">
        {conteudo}
        <span className="absolute right-3 bottom-3 text-xs font-medium text-accent-ink">
          Premium para abrir
        </span>
      </div>
    )
  }

  return (
    <Link href={`/deck/${deck.id}`} className="block rounded-panel focus-visible:outline-2 focus-visible:outline-accent-ink">
      {conteudo}
    </Link>
  )
}
