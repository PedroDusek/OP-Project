/**
 * O endereço de uma arte no TCGplayer.
 *
 * Camada: domain. Puro: recebe o id do produto, devolve o endereço.
 *
 * ## Sai do vínculo, e só dele
 *
 * O produto da fonte de preço **é** o produto do TCGplayer, com o mesmo número —
 * conferido no arquivo da Romance Dawn: o produto `454513` é
 * `Roronoa Zoro (001) (Parallel)` em `tcgplayer.com/product/454513`. Então cada
 * arte com vínculo (decisões 053, 068 e 072) tem o link exato, sem trabalho a
 * mais.
 *
 * O endereço só com o número responde igual ao que traz o nome do produto no
 * fim, e é o que dá para montar com o que o banco guarda.
 *
 * ## Sem vínculo, sem link
 *
 * A Liga cai na busca pelo código quando não sabe a página (decisão 047). Aqui
 * não: o formato da busca do TCGplayer não foi conferido, e um link que talvez
 * não ache nada é pior que nenhum. A arte sem vínculo simplesmente não mostra o
 * botão.
 */

const PRODUTO = 'https://www.tcgplayer.com/product/'

export function tcgplayerProductUrl(productId: string | null | undefined): string | null {
  const id = productId?.trim()
  if (!id) return null
  return `${PRODUTO}${encodeURIComponent(id)}`
}
