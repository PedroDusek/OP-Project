'use client'

import { CardPicker, type Card, type PickerState } from '@/components/catalog/card-picker'
import { bulkAddAction } from '@/app/(app)/binders/actions'
import type { CatalogVocabulary } from '@/server/application/catalog/vocabulary'

/**
 * Adicionar várias cartas a um local de uma vez (telas 25 a 28).
 *
 * ## O que a operação faz
 *
 * Aumenta a quantidade possuída **e** guarda as cópias aqui, numa transação só.
 * É o que a tela 28 descreve — "esta operação será aplicada na sua coleção",
 * com o local logo acima — e é o gesto que ela atende: abrir pacotes e pôr as
 * cartas no binder.
 *
 * Guardar cópias que a pessoa **já tem** é outra tela, `/binders/sem-lugar`,
 * que não mexe na quantidade.
 *
 * ## Por que isto virou uma casca
 *
 * O seletor — grade, filtros, contadores, formulário escondido — é o mesmo que
 * a want list precisa, e está em `catalog/card-picker`. O que sobra aqui é o
 * que é do armazenamento: a ação, o local de destino e o texto que fala em
 * guardar. Copiar as 400 linhas do seletor deixaria duas cópias de decisões
 * sutis que só se lembraria de consertar num lugar.
 */
export function BulkAdd({
  storageLocationId,
  locationName,
  vocabulary,
  initialCards,
  initialTotal,
}: {
  storageLocationId: string
  locationName: string
  vocabulary: CatalogVocabulary
  /** A primeira leva, renderizada no servidor. */
  initialCards: Card[]
  initialTotal: number
}) {
  return (
    <CardPicker
      action={bulkAddAction as (previous: PickerState, data: FormData) => Promise<PickerState>}
      hiddenFields={{ storageLocationId }}
      vocabulary={vocabulary}
      initialCards={initialCards}
      initialTotal={initialTotal}
      copy={{
        destination: locationName,
        confirmTitle: (copies) =>
          `Adicionar ${copies} ${copies === 1 ? 'cópia' : 'cópias'} a ${locationName}?`,
        confirmDescription: (cards) =>
          `${cards} ${cards === 1 ? 'carta diferente' : 'cartas diferentes'}. As cópias entram na sua coleção e ficam guardadas neste local. Não dá para desfazer de uma vez.`,
        successDescription: (cards) =>
          `${cards} ${cards === 1 ? 'carta' : 'cartas'} em ${locationName}`,
      }}
    />
  )
}
