import {
  CARD_RATIO,
  INK,
  LINE,
  MUTED,
  PAPER,
  PLACEHOLDER,
  SHEET_WIDTH,
  drawFooter,
  drawLogotype,
  drawWatermark,
  ellipsis,
  loadImage,
  roundedPath,
  toBlob,
} from './sheet-canvas'

/**
 * Desenhar a want list como uma imagem, no aparelho de quem usa.
 *
 * ## Por que canvas à mão, e não uma biblioteca
 *
 * Nós controlamos o layout inteiro: é uma grade de cartas com um número em
 * cima. Uma biblioteca de "HTML para imagem" existe para o caso oposto — pegar
 * um DOM que você não desenhou —, e traria um pacote grande, um passo de
 * clonagem de estilos e um resultado que muda quando o CSS muda.
 *
 * ## De onde vem a imagem, e por que não direto da Bandai
 *
 * Desenhar num `canvas` uma imagem servida por outro domínio sem
 * `Access-Control-Allow-Origin` **contamina** o canvas, e o `toBlob` passa a
 * falhar — não é limitação de biblioteca, é o navegador impedindo. O host da
 * Bandai não manda o cabeçalho; o CDN do TCGplayer manda `*`, e a imagem dele é
 * limpa, então é a preferida (decisão 058).
 *
 * O que o nosso banco guarda é o número do produto. A imagem é buscada aqui,
 * pelo aparelho de quem usa, direto no CDN do TCGplayer.
 *
 * Quando a carta não tem vínculo, quem chama passa a imagem **do catálogo pelo
 * nosso domínio**, pelo otimizador — mesma origem, e o `canvas` não contamina
 * (decisão 067, ver `lib/catalog-image.ts`). Ela traz a marca "SAMPLE", e por
 * isso só entra quando falta a do TCGplayer.
 *
 * ## Carta sem vínculo não some da folha
 *
 * Sem vínculo ela entra com a imagem do catálogo; sem imagem nenhuma, com o
 * código no lugar da arte. Sumir seria pior: a pessoa levaria
 * ao grupo uma lista incompleta sem saber, e é a lista inteira que faz a folha
 * valer a ida.
 *
 * ## Uma imagem por folha, e não uma imagem gigante
 *
 * Doze cartas por folha, o mesmo corte da impressão — e o mesmo pelo mesmo
 * motivo: quatro colunas por três linhas é o que cabe legível numa página.
 *
 * Uma lista de cem cartas numa imagem só teria 25 linhas e mais de sete mil
 * pixels de altura. O WhatsApp recomprime imagem grande com força, e o número
 * no canto da carta — que é o dado que a folha existe para carregar — é a
 * primeira coisa que borra. Três imagens de doze se mandam num grupo do mesmo
 * jeito que três fotos.
 */

export interface SheetCard {
  cardCode: string
  cardName: string
  /**
   * Uma imagem que o `canvas` pode exportar: a do TCGplayer, ou a do catálogo
   * pelo nosso domínio. Nula quando não há nenhuma — aí a carta sai com o código.
   */
  sheetImageUrl: string | null
  /** Quantas faltam. É o dado que a folha existe para carregar. */
  remaining: number
}

const WIDTH = SHEET_WIDTH
const COLUMNS = 4
/** Doze por folha: quatro colunas, três linhas — o mesmo corte da impressão. */
export const CARDS_PER_SHEET = 12
const GAP = 24
const PADDING = 48
const HEADER = 132
const FOOTER = 64
const CAPTION = 46

/**
 * Uma imagem por folha de doze.
 *
 * Devolve na ordem, e sempre ao menos uma: a tela decide o que fazer com a
 * lista, e receber um array vazio de volta seria um caso a mais para ela tratar
 * sem nada a ganhar.
 */
export async function renderWantSheets(cards: readonly SheetCard[]): Promise<Blob[]> {
  const folhas: SheetCard[][] = []
  for (let i = 0; i < cards.length; i += CARDS_PER_SHEET) {
    folhas.push(cards.slice(i, i + CARDS_PER_SHEET))
  }
  if (folhas.length === 0) folhas.push([])

  /*
   * As folhas sao desenhadas em paralelo, e a ordem vem do `Promise.all` e nao
   * da ordem em que terminam.
   *
   * Sequencial, uma lista de quarenta cartas espera quatro rodadas de rede uma
   * depois da outra — e isso e tempo com o botao de compartilhar desabilitado,
   * olhando para quem so queria mandar a lista no grupo.
   *
   * Isto nao esbarra na mitigacao da decisao 020: as requisicoes serializadas de
   * la sao as do **nosso servidor** contra a Bandai, na importacao do catalogo.
   * Estas saem do navegador de quem usa, contra o CDN da fonte de preco, e a
   * mesma tela ja carrega essas imagens para desenhar a folha.
   */
  return Promise.all(
    folhas.map((folha, indice) =>
      renderWantSheet(folha, { page: indice + 1, pages: folhas.length }),
    ),
  )
}

export interface SheetPage {
  page: number
  pages: number
}

export async function renderWantSheet(
  cards: readonly SheetCard[],
  pagina: SheetPage = { page: 1, pages: 1 },
): Promise<Blob> {
  const cardWidth = Math.floor((WIDTH - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS)
  const cardHeight = Math.round(cardWidth * CARD_RATIO)
  const rows = Math.ceil(cards.length / COLUMNS)
  const height =
    HEADER + rows * (cardHeight + CAPTION) + Math.max(0, rows - 1) * GAP + FOOTER + PADDING

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Este navegador não conseguiu preparar a imagem.')

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, WIDTH, height)

  await drawWatermark(ctx, WIDTH, height)
  await drawHeader(ctx, cards, pagina)

  /*
   * Todas as imagens de uma vez, e nenhuma pode derrubar a folha: quem falhar
   * vira o mesmo espaço reservado de quem não tem vínculo. Uma carta fora do ar
   * não é motivo para a pessoa ficar sem a lista.
   */
  const images = await Promise.all(cards.map((card) => loadImage(card.sheetImageUrl)))

  cards.forEach((card, index) => {
    const column = index % COLUMNS
    const row = Math.floor(index / COLUMNS)
    const x = PADDING + column * (cardWidth + GAP)
    const y = HEADER + row * (cardHeight + CAPTION + GAP)

    drawCard(ctx, card, images[index], x, y, cardWidth, cardHeight)
  })

  drawFooter(ctx, WIDTH, height, PADDING)

  return toBlob(canvas)
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  card: SheetCard,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const radius = 10

  ctx.save()
  roundedPath(ctx, x, y, width, height, radius)
  ctx.clip()

  if (image) {
    ctx.drawImage(image, x, y, width, height)
  } else {
    ctx.fillStyle = PLACEHOLDER
    ctx.fillRect(x, y, width, height)
    ctx.fillStyle = MUTED
    ctx.font = `600 ${Math.round(width / 9)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(card.cardCode, x + width / 2, y + height / 2, width - 16)
  }
  ctx.restore()

  // A quantidade sobre a arte, no canto: é o dado que a folha carrega, e no
  // canto ele não come a ilustração que faz a carta ser reconhecida.
  const badge = `${card.remaining}x`
  ctx.font = `700 ${Math.round(width / 7)}px system-ui, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const padding = 10
  const badgeWidth = ctx.measureText(badge).width + padding * 2
  const badgeHeight = Math.round(width / 5)
  const badgeX = x + width - badgeWidth - 8
  const badgeY = y + height - badgeHeight - 8

  ctx.fillStyle = INK
  roundedPath(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 8)
  ctx.fill()
  ctx.fillStyle = PAPER
  ctx.fillText(badge, badgeX + padding, badgeY + badgeHeight / 2 - Math.round(width / 14))

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = INK
  ctx.font = `600 ${Math.round(width / 13)}px system-ui, sans-serif`
  ctx.fillText(card.cardCode, x, y + height + 8, width)

  ctx.fillStyle = MUTED
  ctx.font = `400 ${Math.round(width / 14)}px system-ui, sans-serif`
  ctx.fillText(ellipsis(ctx, card.cardName, width), x, y + height + 26, width)
}

async function drawHeader(
  ctx: CanvasRenderingContext2D,
  cards: readonly SheetCard[],
  pagina: SheetPage,
): Promise<void> {
  const copies = cards.reduce((total, card) => total + card.remaining, 0)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  ctx.font = '700 40px system-ui, sans-serif'
  ctx.fillText('Procuro estas cartas', PADDING, 68)

  ctx.fillStyle = MUTED
  ctx.font = '400 22px system-ui, sans-serif'
  // A contagem e a de **esta** folha. Quem recebe a terceira imagem precisa
  // saber que ha uma primeira e uma segunda, senao le uma lista truncada como
  // se fosse a lista inteira.
  const contagem =
    `${cards.length} ${cards.length === 1 ? 'carta' : 'cartas'} · ` +
    `${copies} ${copies === 1 ? 'cópia' : 'cópias'}`
  ctx.fillText(
    pagina.pages > 1 ? `${contagem} · folha ${pagina.page} de ${pagina.pages}` : contagem,
    PADDING,
    100,
  )

  await drawLogotype(ctx, WIDTH - PADDING, 44, 34)

  ctx.strokeStyle = LINE
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PADDING, HEADER - 24)
  ctx.lineTo(WIDTH - PADDING, HEADER - 24)
  ctx.stroke()
}
