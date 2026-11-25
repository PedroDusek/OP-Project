import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CardArtLink } from '@/components/catalog/card-art-link'

/**
 * A arte que leva ao catálogo, agora num componente só (pedido do dono do
 * produto em 11/11, estendido ao Início, à Social e às trocas).
 *
 * O que se protege aqui é o contrato que as cinco telas compartilham: o
 * endereço, o nome acessível, a arte que não repete o nome e o selo que fica
 * **dentro** do link. Cada tela testa que usa isto; a forma do link é aqui.
 */
describe('CardArtLink', () => {
  it('leva à carta e se anuncia pelo código', () => {
    render(<CardArtLink variantId="70" code="OP13-004" imageUrl={null} sizes="48px" />)

    expect(screen.getByRole('link', { name: 'Ver OP13-004 no catálogo' })).toHaveAttribute(
      'href',
      '/catalogo/carta/70',
    )
  })

  /*
   * O código e o nome aparecem escritos junto da arte em todas as telas que usam
   * isto. Com `alt` na imagem também, o leitor de tela anunciaria a mesma carta
   * duas vezes por item.
   */
  it('a arte não repete o nome da carta', () => {
    render(
      <CardArtLink variantId="70" code="OP13-004" imageUrl="https://exemplo/op13-004.png" sizes="48px" />,
    )

    expect(screen.queryByRole('img', { name: /OP13-004/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver OP13-004 no catálogo' })).toBeInTheDocument()
  })

  /* O selo de quantidade das grades fica sobre a arte: tocar nele abre a carta. */
  it('o que fica sobre a arte entra dentro do link', () => {
    render(
      <CardArtLink variantId="7" code="OP01-001" imageUrl={null} sizes="96px" className="relative">
        <span>x3</span>
      </CardArtLink>,
    )

    const link = screen.getByRole('link', { name: 'Ver OP01-001 no catálogo' })
    expect(link).toHaveTextContent('x3')
  })
})
