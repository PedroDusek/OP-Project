import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarketPricePanel } from '@/components/catalog/market-price'

/**
 * O painel de preço.
 *
 * O que se protege aqui é o que a tela **diz**, não como ela é: que o valor
 * seja lido como dólar americano, que a data seja apresentada como início de
 * vigência e não como data de conferência, e que a ausência de preço venha com
 * o motivo. Um campo de dinheiro que engana vale menos que um campo vazio.
 */

const desde = new Date('2026-08-12T15:00:00Z')

describe('com cotação', () => {
  it('mostra o valor em dólar americano', () => {
    render(<MarketPricePanel price={{ value: 12.5, since: desde, currency: 'USD' }} variantType="Normal" />)

    expect(screen.getByText('$12.50')).toBeInTheDocument()
  })

  /**
   * A série só ganha linha quando o valor muda, então a data que existe é a da
   * última mudança. "Atualizado em" seria falso numa carta conferida hoje.
   */
  it('apresenta a data como início de vigência, não como conferência', () => {
    render(<MarketPricePanel price={{ value: 3, since: desde, currency: 'USD' }} variantType="Normal" />)

    expect(screen.getByText(/desde 12\/08\/2026/)).toBeInTheDocument()
    expect(screen.queryByText(/atualizado/i)).not.toBeInTheDocument()
  })

  /** Sem isto, o número parece o preço brasileiro. */
  it('diz em voz alta que não é o preço no Brasil', () => {
    render(<MarketPricePanel price={{ value: 3, since: desde, currency: 'USD' }} variantType="Normal" />)

    expect(screen.getByText(/não é o preço no brasil/i)).toBeInTheDocument()
  })
})

describe('sem cotação', () => {
  /**
   * A fonte distingue as artes pelo nome do produto e o nosso catálogo só
   * separa Normal de Parallel: não há como dizer qual paralela é qual.
   */
  it('explica que paralela ainda não tem preço', () => {
    render(<MarketPricePanel price={null} variantType="Parallel" />)

    expect(screen.getByText(/paralelas ainda não têm preço/i)).toBeInTheDocument()
  })

  it('diz que a arte comum não tem cotação, em vez de sumir', () => {
    render(<MarketPricePanel price={null} variantType="Normal" />)

    expect(screen.getByRole('heading', { name: 'Preço de mercado' })).toBeInTheDocument()
    expect(screen.getByText(/sem cotação na fonte/i)).toBeInTheDocument()
  })

  it('não inventa valor nenhum', () => {
    render(<MarketPricePanel price={null} variantType="Normal" />)

    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  })
})
