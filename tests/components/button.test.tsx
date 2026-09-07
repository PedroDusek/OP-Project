import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('chama o clique', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Adicionar</Button>)

    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('nao clica enquanto carrega', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Salvando
      </Button>,
    )

    const button = screen.getByRole('button', { name: /salvando/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')

    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  /**
   * O `asChild` ja quebrou em producao: `Slot` exige um filho unico, e o
   * indicador de progresso somava um segundo no. O teste fixa o contrato de que
   * este ramo renderiza o filho e nada alem dele.
   */
  it('vira link com asChild, sem envolver o filho', () => {
    render(
      <Button asChild>
        <a href="/catalogo">Abrir o catálogo</a>
      </Button>,
    )

    const link = screen.getByRole('link', { name: 'Abrir o catálogo' })
    expect(link).toHaveAttribute('href', '/catalogo')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('marca o link como desativado sem tirar do documento', () => {
    render(
      <Button asChild disabled>
        <a href="/catalogo">Abrir</a>
      </Button>,
    )

    expect(screen.getByRole('link', { name: 'Abrir' })).toHaveAttribute('aria-disabled', 'true')
  })
})
