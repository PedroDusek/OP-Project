import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CollectionDashboardView } from '@/components/dashboard/collection-dashboard'
import type { CollectionDashboard } from '@/server/application/collection'

/**
 * O caminho do Início para a carta (pedido do dono do produto em 11/11).
 *
 * "As mais valiosas" era a única arte do Início, e não tinha gesto nenhum. As
 * contas do painel são do domínio e estão testadas lá; aqui só o link.
 */

const carta = (variantId: string, cardCode: string, unitUsd: number) => ({
  variantId,
  cardCode,
  cardName: `Carta ${cardCode}`,
  variantType: 'Normal',
  rarity: 'SEC',
  imageUrl: null,
  quantity: 1,
  unitUsd,
})

const painel: CollectionDashboard = {
  totalCopies: 2,
  totalValueUsd: 150,
  copiesWithoutPrice: 0,
  completeUsd: 0,
  mostValuable: [carta('70', 'OP13-004', 100), carta('81', 'OP17-080', 50)],
  bySet: [],
  byRarity: [],
  byColor: [],
  byType: [],
  overallValueUsd: 150,
  rate: null,
  sets: [],
}

describe('o dashboard do Início', () => {
  it('a arte de cada uma das mais valiosas abre a carta', () => {
    render(<CollectionDashboardView dashboard={painel} />)

    expect(screen.getByRole('link', { name: 'Ver OP13-004 no catálogo' })).toHaveAttribute(
      'href',
      '/catalogo/carta/70',
    )
    expect(screen.getByRole('link', { name: 'Ver OP17-080 no catálogo' })).toHaveAttribute(
      'href',
      '/catalogo/carta/81',
    )
  })

  /*
   * O valor fica fora do link de propósito: uma linha inteira clicável faria o
   * preço parecer o destino, e o destino é a carta.
   */
  it('o valor não entra no link', () => {
    render(<CollectionDashboardView dashboard={painel} />)

    expect(screen.getByRole('link', { name: 'Ver OP13-004 no catálogo' })).not.toHaveTextContent(
      '100',
    )
    expect(screen.getByText('US$ 100,00')).toBeInTheDocument()
  })
})
