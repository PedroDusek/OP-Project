import { describe, expect, it } from 'vitest'
import { catalogImageForCanvas } from '@/lib/catalog-image'

/**
 * A imagem do catalogo por um endereco que o canvas exporta (decisao 067).
 *
 * Pelo otimizador, do nosso dominio: pedida direto, a imagem da Bandai contamina
 * o canvas e a folha em JPEG nao sai.
 */
describe('catalogImageForCanvas', () => {
  it('passa a imagem pelo otimizador do nosso dominio', () => {
    const url = 'https://en.onepiece-cardgame.com/images/cardlist/card/OP01-016_p1.png'
    expect(catalogImageForCanvas(url)).toBe(`/_next/image?url=${encodeURIComponent(url)}&w=640&q=75`)
  })

  it('devolve nulo quando nao ha imagem que ele sirva', () => {
    expect(catalogImageForCanvas(null)).toBeNull()
    expect(catalogImageForCanvas('')).toBeNull()
    expect(catalogImageForCanvas('/relativa.png')).toBeNull()
  })
})
