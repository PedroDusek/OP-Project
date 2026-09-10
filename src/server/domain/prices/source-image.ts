/**
 * A imagem de uma carta na fonte de preço.
 *
 * Camada: domain. Puro: recebe um id, devolve um endereço.
 *
 * ## Por que existe uma segunda origem de imagem
 *
 * A do catálogo é a da Bandai, e ela é **referenciada na origem, nunca copiada**
 * (decisões 020 e 026). Isso resolve mostrar a carta na tela e não resolve
 * desenhar a carta num arquivo: o host da Bandai não manda
 * `Access-Control-Allow-Origin` — conferido, inclusive com `Origin` na
 * requisição —, então o navegador recusa exportar um `canvas` que a tenha
 * desenhado.
 *
 * O CDN do TCGplayer manda `Access-Control-Allow-Origin: *`. É a única
 * referência de imagem que autoriza leitura cruzada, e é dela que sai a folha
 * em JPEG (decisão 058).
 *
 * ## Continua sendo referência, nunca cópia
 *
 * O que o nosso banco guarda é o **número do produto**. A imagem é buscada pelo
 * aparelho de quem usa, direto da origem, e nunca passa pelo nosso servidor —
 * a mesma regra que vale para a da Bandai, escolha do dono do produto.
 */

const CDN = 'https://tcgplayer-cdn.tcgplayer.com/product'

/**
 * Os tamanhos que o CDN serve.
 *
 * `200w` é miniatura. `in_1000x1000` é o nome do outro, e o que ele **entrega**
 * é 600×838 — medido, não suposto. Serve para a folha; ampliar não serve para
 * nada aqui. Não há nada entre os dois, então não há o que escolher.
 */
export type SourceImageSize = 'thumb' | 'sheet'

export function sourceImageUrl(productId: string, size: SourceImageSize = 'sheet'): string {
  const suffix = size === 'thumb' ? '200w' : 'in_1000x1000'
  return `${CDN}/${encodeURIComponent(productId)}_${suffix}.jpg`
}
