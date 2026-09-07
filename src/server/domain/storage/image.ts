/**
 * O que aceitamos como foto de um local de armazenamento.
 *
 * Camada: domain. Puro — recebe bytes e tamanho, não abre arquivo nem fala com
 * rede.
 *
 * ## Por que os bytes, e não o `type` do arquivo
 *
 * O `Content-Type` de um upload é escolhido pelo navegador a partir da extensão
 * e vai no corpo da requisição: quem manda a requisição escolhe o que ele diz.
 * Como a imagem volta servida para outros navegadores, aceitar a palavra do
 * cliente é aceitar servir qualquer coisa com um rótulo de imagem.
 *
 * Os primeiros bytes de PNG e JPEG são fixos e definidos no formato. Conferir a
 * assinatura não prova que o arquivo inteiro é válido — nem precisa: prova que
 * não é um HTML, um SVG com script ou um executável renomeado, que é a diferença
 * que importa.
 *
 * SVG fica de fora **de propósito**: é um documento XML, pode carregar script, e
 * não tem assinatura de bytes que o distinga de um XML qualquer.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg'] as const
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number]

/** O que a tela mostra no seletor de arquivo, e o `accept` do `<input>`. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(',')

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]

export type ImageRejection = 'VAZIO' | 'GRANDE_DEMAIS' | 'FORMATO_NAO_ACEITO'

export type ImageCheck =
  | { ok: true; type: AcceptedImageType; extension: 'png' | 'jpg' }
  | { ok: false; reason: ImageRejection }

/**
 * Descobre o formato pelos primeiros bytes, ou `null`.
 *
 * JPEG tem variantes no quarto byte (JFIF, Exif, e outras); os três primeiros
 * são comuns a todas, e é só isso que se confere.
 */
export function detectImageType(bytes: Uint8Array): AcceptedImageType | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return 'image/png'
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'image/jpeg'
  return null
}

export function checkImage(bytes: Uint8Array): ImageCheck {
  if (bytes.byteLength === 0) return { ok: false, reason: 'VAZIO' }
  if (bytes.byteLength > MAX_IMAGE_BYTES) return { ok: false, reason: 'GRANDE_DEMAIS' }

  const type = detectImageType(bytes)
  if (!type) return { ok: false, reason: 'FORMATO_NAO_ACEITO' }

  return { ok: true, type, extension: type === 'image/png' ? 'png' : 'jpg' }
}

export const IMAGE_REJECTION_MESSAGE: Record<ImageRejection, string> = {
  VAZIO: 'O arquivo está vazio.',
  GRANDE_DEMAIS: 'A imagem precisa ter no máximo 5 MB.',
  FORMATO_NAO_ACEITO: 'Envie uma imagem PNG ou JPG.',
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.byteLength < signature.length) return false
  return signature.every((byte, index) => bytes[index] === byte)
}
