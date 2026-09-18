import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from '@/components/layout/app-shell'

/**
 * O voltar de toda tela (pedido do dono do produto em 18/09). O destino é fixo,
 * e não o histórico: quem chega por link compartilhado não tem para onde voltar
 * dentro do ColeXa.
 */
describe('PageHeader', () => {
  it('mostra o voltar com o destino e o nome dito ao leitor de tela', () => {
    render(<PageHeader title="Binders" back={{ href: '/inicio', label: 'o Início' }} />)

    const voltar = screen.getByRole('link', { name: 'Voltar para o Início' })
    expect(voltar).toHaveAttribute('href', '/inicio')
    expect(screen.getByRole('heading', { level: 1, name: 'Binders' })).toBeInTheDocument()
  })

  /* O Início é a raiz: é a única tela sem voltar. */
  it('não inventa um voltar quando a tela não pede', () => {
    render(<PageHeader title="Olá, Pedro" />)

    expect(screen.queryByRole('link', { name: /voltar/i })).not.toBeInTheDocument()
  })
})
