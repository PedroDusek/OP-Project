import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Segmented } from '@/components/ui/segmented'
import { Chip } from '@/components/ui/chip'

const OPTIONS = [
  { value: 'todas', label: 'Todas', count: 1284 },
  { value: 'playsets', label: 'Playsets', count: 186 },
  { value: 'faltam', label: 'Faltam' },
]

describe('Segmented', () => {
  it('marca a opcao ativa como selecionada', () => {
    render(
      <Segmented label="Filtro" options={OPTIONS} value="playsets" onValueChange={vi.fn()} />,
    )

    expect(screen.getByRole('tab', { name: /playsets/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /todas/i })).toHaveAttribute('aria-selected', 'false')
  })

  /**
   * So a opcao ativa fica na ordem de tabulacao. E o padrao de abas: o teclado
   * entra no grupo uma vez e caminha com as setas, em vez de parar em cada
   * filtro — o que, numa lista de dez, atrapalha mais do que ajuda.
   */
  it('deixa apenas a ativa alcancavel por Tab', () => {
    render(<Segmented label="Filtro" options={OPTIONS} value="todas" onValueChange={vi.fn()} />)

    expect(screen.getByRole('tab', { name: /todas/i })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: /playsets/i })).toHaveAttribute('tabindex', '-1')
  })

  it('caminha com as setas e da a volta', async () => {
    const onValueChange = vi.fn()
    render(<Segmented label="Filtro" options={OPTIONS} value="todas" onValueChange={onValueChange} />)

    const first = screen.getByRole('tab', { name: /todas/i })
    first.focus()

    await userEvent.keyboard('{ArrowRight}')
    expect(onValueChange).toHaveBeenLastCalledWith('playsets')

    await userEvent.keyboard('{ArrowLeft}')
    expect(onValueChange).toHaveBeenLastCalledWith('faltam')
  })

  it('mostra a contagem quando existe', () => {
    render(<Segmented label="Filtro" options={OPTIONS} value="todas" onValueChange={vi.fn()} />)

    expect(screen.getByRole('tab', { name: /Todas.*1284/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Faltam' })).toBeInTheDocument()
  })
})

describe('Chip', () => {
  it('expoe o estado por aria-pressed, nao so pela cor', async () => {
    const onClick = vi.fn()
    render(
      <Chip selected onClick={onClick}>
        SR
      </Chip>,
    )

    const chip = screen.getByRole('button', { name: 'SR' })
    expect(chip).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(chip)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
