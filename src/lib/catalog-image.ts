/**
 * A imagem do catálogo por um endereço que um `canvas` consegue exportar.
 *
 * ## Por que existe
 *
 * A folha em JPEG desenha as cartas num `canvas`, e o navegador só deixa
 * exportar um `canvas` cujas imagens autorizem leitura. A imagem da Bandai, pedida
 * direto, não autoriza — o host não manda `Access-Control-Allow-Origin`, e a
 * imagem nem chega a carregar com `crossOrigin`.
 *
 * Mas desde a decisão 038 a imagem da carta é servida **pelo nosso domínio**,
 * pelo otimizador do Next. Imagem do mesmo domínio não contamina o `canvas`.
 * Medido em 10/09/2026, no navegador: a paralela `OP01-016_p1` pelo otimizador
 * carregou, foi desenhada e exportou um JPEG de 600×838 — o mesmo tamanho que o
 * TCGplayer entrega. A mesma imagem pedida direto na Bandai não carregou.
 *
 * ## Por que é só o que sobra
 *
 * A imagem do TCGplayer continua sendo a primeira escolha, porque é limpa: a da
 * Bandai traz a marca "SAMPLE" atravessada na arte. Esta entra quando a carta não
 * tem vínculo com a fonte de preço — hoje, 1.168 paralelas — e é o que tira o
 * código escrito do lugar da arte (decisão 067).
 *
 * ## A largura
 *
 * `640` porque o otimizador só aceita as larguras configuradas, e esta é uma
 * delas — conferida no pedido real, que respondeu 200. A folha desenha cada carta
 * com menos de 300 pixels de largura, então não há o que ganhar pedindo mais.
 */

const LARGURA = 640
const QUALIDADE = 75

/** O endereço pelo otimizador, ou `null` quando não há imagem que ele sirva. */
export function catalogImageForCanvas(imageUrl: string | null): string | null {
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl.trim())) return null
  return `/_next/image?url=${encodeURIComponent(imageUrl.trim())}&w=${LARGURA}&q=${QUALIDADE}`
}
