'use client'

import { CardPicker, type Card, type PickerState } from '@/components/catalog/card-picker'
import { bulkWantAction } from '@/app/(app)/colecao/actions'
import type { CatalogVocabulary } from '@/server/application/catalog/vocabulary'

/**
 * Acrescentar várias cartas à want list de uma vez.
 *
 * O mesmo gesto da leva de armazenamento — percorrer o catálogo com filtros e ir
 * marcando quantas de cada —, e por isso o mesmo seletor. O que muda é o
 * destino: aqui a leva **não toca na coleção**, só na lista do que falta.
 *
 * O texto diz "acrescentar" e não "definir" porque é o que a operação faz: quem
 * já quer duas e marca mais uma passa a querer três. Substituir apagaria em
 * silêncio o que a pessoa anotou carta a carta.
 */
export function WantBulkAdd({
  vocabulary,
  initialCards,
  initialTotal,
}: {
  vocabulary: CatalogVocabulary
  /** A primeira leva, renderizada no servidor. */
  initialCards: Card[]
  initialTotal: number
}) {
  return (
    <CardPicker
      action={bulkWantAction as (previous: PickerState, data: FormData) => Promise<PickerState>}
      vocabulary={vocabulary}
      initialCards={initialCards}
      initialTotal={initialTotal}
      copy={{
        destination: 'want list',
        confirmTitle: (copies) =>
          `Acrescentar ${copies} ${copies === 1 ? 'cópia' : 'cópias'} à sua want list?`,
        confirmDescription: (cards) =>
          `${cards} ${cards === 1 ? 'carta diferente' : 'cartas diferentes'}. As quantidades somam ao que você já queria, e nada é adicionado à sua coleção.`,
        successDescription: (cards) =>
          `${cards} ${cards === 1 ? 'carta' : 'cartas'} na sua want list`,
      }}
    />
  )
}
