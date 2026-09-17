/**
 * O endereço da imagem otimizada de uma carta (decisão 094).
 *
 * Camada: domain. Puro: monta o endereço, não busca nada.
 *
 * É o mesmo endereço que o `next/image` pede no navegador. O pré-aquecimento
 * existe porque a **primeira** pessoa a ver cada carta paga a ida até o servidor
 * da Bandai, no Japão: cerca de 3 segundos por imagem de até 2,2 MB. Pedindo
 * antes, quem chega encontra a versão leve já pronta no volume (decisão 090).
 */

/**
 * As larguras que o navegador escolhe na prática para a grade de cartas.
 *
 * O `sizes` da grade dá 33vw no celular e 12vw no desktop; com a densidade de
 * tela comum, a conta cai nestas duas da lista do Next. Aquecer todas as larguras
 * possíveis multiplicaria por oito o trabalho para servir o mesmo.
 */
export const WARMUP_WIDTHS = [256, 384] as const

/** A qualidade padrão do `next/image`. Mudar aqui sem mudar lá aquece o que ninguém pede. */
export const WARMUP_QUALITY = 75

export function optimizedImageUrl(
  appUrl: string,
  imageUrl: string,
  width: number,
  quality: number = WARMUP_QUALITY,
): string {
  const base = appUrl.replace(/\/+$/, '')
  return `${base}/_next/image?url=${encodeURIComponent(imageUrl)}&w=${width}&q=${quality}`
}
