import { existsSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { hasSetCover, SetCover } from '@/components/catalog/set-cover'

/**
 * A imagem do produto de cada set, feita pelo dono do produto (decisão 099).
 */
describe('SetCover', () => {
  it('casa o código como a fonte grafa, com hífen ou sem', () => {
    expect(hasSetCover('OP-01')).toBe(true)
    expect(hasSetCover('OP01')).toBe(true)
    expect(hasSetCover('ST-36')).toBe(true)
    // O booster que o lançamento internacional juntou ao EB-04.
    expect(hasSetCover('OP14-EB04')).toBe(true)
    expect(hasSetCover('PROMO')).toBe(false)
  })

  it('manda as duas versões, e o CSS mostra a do tema', () => {
    const { container } = render(<SetCover code="OP-13" alt="OP13" sizes="56px" />)
    const imagens = container.querySelectorAll('img')
    expect(imagens).toHaveLength(2)
    expect(decodeURIComponent(imagens[0].getAttribute('src')!)).toContain('/sets/claro/op13.webp')
    expect(imagens[0]).toHaveClass('so-tema-claro')
    expect(decodeURIComponent(imagens[1].getAttribute('src')!)).toContain('/sets/escuro/op13.webp')
    expect(imagens[1]).toHaveClass('so-tema-escuro')
  })

  it('set sem imagem mostra a reserva', () => {
    render(<SetCover code="PROMO" alt="" sizes="56px" fallback={<span>PROMO</span>} />)
    expect(screen.getByText('PROMO')).toBeInTheDocument()
  })

  /** A lista do componente e os arquivos andam juntos: um sem o outro é imagem quebrada. */
  it('cada arquivo está na lista, nas duas versões', () => {
    const arquivos = readdirSync('public/sets/claro')
    expect(arquivos).toHaveLength(58)
    for (const arquivo of arquivos) {
      expect(hasSetCover(arquivo.replace('.webp', ''))).toBe(true)
      expect(existsSync(`public/sets/escuro/${arquivo}`)).toBe(true)
    }
  })
})
