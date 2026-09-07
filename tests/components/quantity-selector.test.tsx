import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuantitySelector } from '@/components/ui/quantity-selector'

/**
 * O campo e controlado, entao testar a digitacao exige um dono do estado. Sem
 * ele o valor exibido nunca muda, e o que se estaria testando e o harness, nao
 * o componente.
 */
function Harness({
  initial = 0,
  min,
  max,
  onValueChange,
}: {
  initial?: number
  min?: number
  max?: number
  onValueChange?: (value: number) => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <QuantitySelector
      value={value}
      onValueChange={(next) => {
        setValue(next)
        onValueChange?.(next)
      }}
      label="Quantidade"
      min={min}
      max={max}
    />
  )
}

describe('QuantitySelector', () => {
  it('soma e subtrai uma copia', async () => {
    const onValueChange = vi.fn()
    render(<Harness initial={3} onValueChange={onValueChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Aumentar Quantidade' }))
    expect(onValueChange).toHaveBeenLastCalledWith(4)

    await userEvent.click(screen.getByRole('button', { name: 'Diminuir Quantidade' }))
    expect(onValueChange).toHaveBeenLastCalledWith(3)
  })

  it('nao desce abaixo do minimo nem sobe acima do maximo', () => {
    const { rerender } = render(
      <QuantitySelector value={0} onValueChange={vi.fn()} label="Quantidade" min={0} max={4} />,
    )
    expect(screen.getByRole('button', { name: 'Diminuir Quantidade' })).toBeDisabled()

    rerender(
      <QuantitySelector value={4} onValueChange={vi.fn()} label="Quantidade" min={0} max={4} />,
    )
    expect(screen.getByRole('button', { name: 'Aumentar Quantidade' })).toBeDisabled()
  })

  /**
   * Apagar tudo para digitar outro numero e o gesto normal no celular. O campo
   * vazio precisa virar o minimo, e nao `NaN`, que quebraria a tela inteira no
   * meio da digitacao.
   */
  it('trata campo vazio como o minimo', async () => {
    const onValueChange = vi.fn()
    render(<Harness initial={3} min={0} onValueChange={onValueChange} />)

    await userEvent.clear(screen.getByRole('textbox', { name: 'Quantidade' }))

    expect(onValueChange).toHaveBeenLastCalledWith(0)
    expect(screen.getByRole('textbox', { name: 'Quantidade' })).toHaveValue('0')
  })

  it('ignora o que nao for digito', async () => {
    render(<Harness initial={0} />)

    const input = screen.getByRole('textbox', { name: 'Quantidade' })
    await userEvent.clear(input)
    await userEvent.type(input, 'a2b')

    expect(input).toHaveValue('2')
  })

  it('limita o que for digitado acima do maximo', async () => {
    render(<Harness initial={0} max={4} />)

    const input = screen.getByRole('textbox', { name: 'Quantidade' })
    await userEvent.clear(input)
    await userEvent.type(input, '9')

    expect(input).toHaveValue('4')
  })
})
