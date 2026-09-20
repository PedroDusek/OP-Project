'use client'

import { CardGrid, CardTile } from './card-tile'
import { LoadMore } from './load-more'
import { useInfiniteItems } from './use-infinite-items'
import { cardCountLabel } from '@/server/domain/catalog/sets'
import { cardHref } from '@/lib/catalog-params'

/**
 * Grade que carrega mais ao chegar no fim.
 *
 * ## Por que existe um botao, e nao so o sentinela
 *
 * O botao **e** o sentinela: o observador de interseccao dispara a mesma carga
 * que o clique. Isso resolve de uma vez tres casos em que rolagem infinita pura
 * deixa a pessoa presa — quem navega por teclado e nunca "rola ate o fim", quem
 * usa leitor de tela, e o momento em que uma carga falha e e preciso repetir.
 *
 * Tambem e o que torna o comportamento testavel sem simular rolagem.
 *
 * ## A mecanica mora no gancho
 *
 * Desde 20/09 o carregar mais esta em `use-infinite-items`, compartilhado com
 * Minha Colecao. O que ficou aqui e o que e do catalogo: a etiqueta de cada
 * carta e o link para o detalhe. As decisoes sutis do gancho — a trava contra
 * chamada dupla, o reinicio ao trocar de filtro, o observador montado uma vez —
 * estao documentadas la.
 *
 * ## Por que passa pela API, e nao por uma Server Action
 *
 * `/api/catalog` cobra a cota de leitura do catalogo por usuario. Essa cota e o
 * que sustenta na pratica o compromisso da decisao 020 de nunca reexpor o
 * catalogo. Uma Server Action escaparia dela, e a rolagem infinita viraria a
 * forma mais conveniente de extrair o catalogo inteiro.
 */

export interface CatalogItemView {
  /** `bigint` vira string na fronteira: JSON nao serializa BigInt. */
  variantId: string
  cardCode: string
  cardName: string
  rarity: string | null
  variantType: string
  imageUrl: string | null
}

export interface InfiniteCardGridProps {
  initialItems: CatalogItemView[]
  total: number
  pageSize: number
  /** Query da API sem `page`, ja traduzida do portugues da URL. */
  apiQuery: string
  /**
   * O caminho desta lista, com os filtros, para o detalhe saber para onde
   * voltar. Sem ele, voltar devolve o catalogo inteiro e a pessoa refaz o
   * filtro a cada carta que registra.
   */
  origin?: string
}

export function InfiniteCardGrid({
  initialItems,
  total,
  pageSize,
  apiQuery,
  origin,
}: InfiniteCardGridProps) {
  const { items, loading, error, done, loadMore, sentinel } = useInfiniteItems<CatalogItemView>({
    initialItems,
    total,
    endpoint: '/api/catalog',
    apiQuery,
  })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted tabular-nums" role="status">
        {cardCountLabel(total)}
      </p>

      <CardGrid>
        {items.map((item, index) => (
          <CardTile
            key={item.variantId}
            code={item.cardCode}
            name={item.cardName}
            imageUrl={item.imageUrl}
            labels={labelsFor(item.rarity, item.variantType)}
            href={cardHref(item.variantId, origin)}
            // A primeira fileira aparece sem esperar a rolagem; o resto e tardio.
            priority={index < 3}
          />
        ))}
      </CardGrid>

      <LoadMore
        done={done}
        loading={loading}
        error={error}
        shown={items.length}
        pageSize={pageSize}
        onLoadMore={() => void loadMore()}
        sentinel={sentinel}
      />
    </div>
  )
}

/**
 * A etiqueta traz a raridade sempre, e a variante so quando ela nao e Normal.
 *
 * "Normal" em toda carta e ruido: e o caso comum, e o que a pessoa procura na
 * grade e justamente o que **nao** e comum.
 */
function labelsFor(rarity: string | null, variantType: string): string[] {
  const labels: string[] = []
  if (rarity) labels.push(rarity)
  if (variantType && variantType !== 'Normal') labels.push(variantType)
  return labels
}
