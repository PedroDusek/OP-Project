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
 * O CDN do TCGplayer manda `Access-Control-Allow-Origin: *`, e a imagem dele é
 * limpa. É a preferida da folha em JPEG (decisão 058).
 *
 * Não é mais a única que a folha consegue usar. Desde a decisão 038 a imagem do
 * catálogo é servida pelo nosso domínio, pelo otimizador, e imagem do mesmo
 * domínio não contamina o `canvas`. A folha usa essa quando a carta não tem
 * vínculo — ela traz a marca "SAMPLE" (decisão 067).
 *
 * ## Continua sendo referência, nunca cópia
 *
 * O que o nosso banco guarda é o **número do produto**. A imagem é buscada pelo
 * aparelho de quem usa, direto da origem, e nunca passa pelo nosso servidor —
 * escolha do dono do produto. (A decisão 058 dizia que a da Bandai seguia a
 * mesma regra; desde a 038 ela passa pelo otimizador, e a 067 registra a
 * correção.)
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
