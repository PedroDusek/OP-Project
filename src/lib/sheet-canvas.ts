import { SYMBOL, LOGOTYPE } from './marca'
import { SHEET_RIGHTS_NOTICE } from '@/lib/want-sheet-notice'

/**
 * O que a folha da want list e a da decklist fazem igual.
 *
 * Saiu de `want-sheet-image.ts` em 23/11, quando a decklist ganhou a própria
 * folha: carregar imagem sem contaminar o canvas, exportar, cantar arredondado,
 * cortar texto com reticências, a marca d'água e o rodapé eram os mesmos nas
 * duas, e duas cópias divergiriam no primeiro ajuste de cor ou de margem.
 *
 * O que **não** vem para cá é o layout. A want list é uma grade de doze por
 * folha com o número do que falta; a decklist é uma imagem só, por seção, com
 * custo e cópias. Compartilham a mecânica, não a forma.
 */

/** A proporção da carta física. */
export const CARD_RATIO = 7 / 5

/** Largura fixa: uma imagem para mandar em grupo, não para ampliar. */
export const SHEET_WIDTH = 1240

export const INK = '#131219'
export const MUTED = '#6b6a76'
export const PAPER = '#ffffff'
export const ACCENT = '#5b4bd6'
export const LINE = '#e6e4ee'
export const PLACEHOLDER = '#eceaf3'

/**
 * Carrega uma imagem para desenhar, ou devolve nulo.
 *
 * `crossOrigin = 'anonymous'` é obrigatório: sem ele o navegador carrega a
 * imagem mas contamina o canvas, e a falha só apareceria no `toBlob`, longe da
 * causa. Com ele, uma origem sem `Access-Control-Allow-Origin` falha aqui, e
 * a carta cai no espaço reservado.
 */
export function loadImage(url: string | null): Promise<HTMLImageElement | null> {
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
export function loadSvg(markup: string): Promise<HTMLImageElement | null> {
  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`)
}

export function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
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

export function roundedPath(
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
export function ellipsis(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text

  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) {
    cut = cut.slice(0, -1)
  }
  return `${cut}…`
}

/** O X da marca, apagado ao fundo. Divulgação, e forma própria da marca. */
export async function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): Promise<void> {
  const mark = await loadSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SYMBOL.width} ${SYMBOL.height}">` +
      `<path d="${SYMBOL.path}" fill-rule="${SYMBOL.fillRule}" fill="${ACCENT}"/></svg>`,
  )
  if (!mark) return

  const markHeight = height * 0.9
  const markWidth = (SYMBOL.width / SYMBOL.height) * markHeight

  ctx.save()
  ctx.globalAlpha = 0.05
  ctx.drawImage(mark, width - markWidth * 0.62, height * 0.05, markWidth, markHeight)
  ctx.restore()
}

/** O logotipo no alto à direita, na altura pedida. Devolve a largura usada. */
export async function drawLogotype(
  ctx: CanvasRenderingContext2D,
  right: number,
  top: number,
  logoHeight: number,
): Promise<void> {
  const logo = await loadSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGOTYPE.width} ${LOGOTYPE.height}">` +
      `<path d="${LOGOTYPE.letters}" fill-rule="${LOGOTYPE.fillRule}" fill="${INK}"/>` +
      `<path d="${LOGOTYPE.symbol}" fill-rule="${LOGOTYPE.fillRule}" fill="${ACCENT}"/>` +
      `</svg>`,
  )
  if (!logo) return

  const logoWidth = (LOGOTYPE.width / LOGOTYPE.height) * logoHeight
  ctx.drawImage(logo, right - logoWidth, top, logoWidth, logoHeight)
}

/**
 * O rodapé: de onde veio a folha, e o aviso de direitos.
 *
 * O aviso não é enfeite — é a atribuição da decisão 020 viajando junto com a
 * imagem, que sai do produto e vai para um grupo onde ninguém vê o rodapé do
 * site.
 */
export function drawFooter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  padding: number,
): void {
  const y = height - padding + 12
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = MUTED
  ctx.font = '400 18px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('Lista gerada no ColeXa · colexa.com.br', padding, y)
  ctx.textAlign = 'right'
  ctx.fillText(SHEET_RIGHTS_NOTICE, width - padding, y)
}
