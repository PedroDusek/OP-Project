import { SYMBOL, LOGOTYPE } from './marca'

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
 * ## Por que a imagem vem do TCGplayer, e não da Bandai
 *
 * Porque é a única que o navegador deixa exportar. Desenhar num `canvas` uma
 * imagem servida sem `Access-Control-Allow-Origin` **contamina** o canvas, e o
 * `toBlob` passa a falhar — não é limitação de biblioteca, é o navegador
 * impedindo. O host da Bandai não manda o cabeçalho; o CDN do TCGplayer manda
 * `*` (decisão 058).
 *
 * O que o nosso banco guarda é o número do produto. A imagem é buscada aqui,
 * pelo aparelho de quem usa, e nunca passa pelo nosso servidor.
 *
 * ## Carta sem vínculo não some da folha
 *
 * Ela entra com o código no lugar da arte. Sumir seria pior: a pessoa levaria
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
  /** A imagem que autoriza leitura cruzada. Nulo quando não há vínculo. */
  sheetImageUrl: string | null
  /** Quantas faltam. É o dado que a folha existe para carregar. */
  remaining: number
}

/** Largura fixa: uma imagem para mandar em grupo, não para ampliar. */
const WIDTH = 1240
const COLUMNS = 4
/** Doze por folha: quatro colunas, três linhas — o mesmo corte da impressão. */
export const CARDS_PER_SHEET = 12
const GAP = 24
const PADDING = 48
const HEADER = 132
const FOOTER = 64
/** A proporção da carta física. */
const CARD_RATIO = 7 / 5
const CAPTION = 46

const INK = '#131219'
const MUTED = '#6b6a76'
const PAPER = '#ffffff'
const ACCENT = '#5b4bd6'

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

  await drawWatermark(ctx, height)
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

  drawFooter(ctx, height)

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
    ctx.fillStyle = '#eceaf3'
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

  const logo = await loadSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGOTYPE.width} ${LOGOTYPE.height}">` +
      `<path d="${LOGOTYPE.letters}" fill-rule="${LOGOTYPE.fillRule}" fill="${INK}"/>` +
      `<path d="${LOGOTYPE.symbol}" fill-rule="${LOGOTYPE.fillRule}" fill="${ACCENT}"/>` +
      `</svg>`,
  )
  if (logo) {
    const logoHeight = 34
    const logoWidth = (LOGOTYPE.width / LOGOTYPE.height) * logoHeight
    ctx.drawImage(logo, WIDTH - PADDING - logoWidth, 44, logoWidth, logoHeight)
  }

  ctx.strokeStyle = '#e6e4ee'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PADDING, HEADER - 24)
  ctx.lineTo(WIDTH - PADDING, HEADER - 24)
  ctx.stroke()
}

/** O X da marca, apagado ao fundo. Divulgação, e forma própria da marca. */
async function drawWatermark(ctx: CanvasRenderingContext2D, height: number): Promise<void> {
  const mark = await loadSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SYMBOL.width} ${SYMBOL.height}">` +
      `<path d="${SYMBOL.path}" fill-rule="${SYMBOL.fillRule}" fill="${ACCENT}"/></svg>`,
  )
  if (!mark) return

  const markHeight = height * 0.9
  const markWidth = (SYMBOL.width / SYMBOL.height) * markHeight

  ctx.save()
  ctx.globalAlpha = 0.05
  ctx.drawImage(mark, WIDTH - markWidth * 0.62, height * 0.05, markWidth, markHeight)
  ctx.restore()
}

function drawFooter(ctx: CanvasRenderingContext2D, height: number): void {
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = MUTED
  ctx.font = '400 18px system-ui, sans-serif'
  ctx.fillText('Lista gerada no ColeXa · colexa.com.br', PADDING, height - PADDING + 12)
}

/**
 * Carrega uma imagem para desenhar, ou devolve nulo.
 *
 * `crossOrigin = 'anonymous'` é obrigatório: sem ele o navegador carrega a
 * imagem mas contamina o canvas, e a falha só apareceria no `toBlob`, longe da
 * causa. Com ele, uma origem sem `Access-Control-Allow-Origin` falha aqui, e
 * a carta cai no espaço reservado.
 */
function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)

  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })
}

/** SVG vira `data:`, que nunca contamina o canvas por não ter origem. */
function loadSvg(markup: string): Promise<HTMLImageElement | null> {
  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`)
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Não foi possível gerar a imagem.'))
      },
      'image/jpeg',
      0.92,
    )
  })
}

function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

/** Corta com reticências: nome comprido empurraria o da carta ao lado. */
function ellipsis(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text

  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) {
    cut = cut.slice(0, -1)
  }
  return `${cut}…`
}
