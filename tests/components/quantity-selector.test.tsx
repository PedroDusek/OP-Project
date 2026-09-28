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
  bulk,
  onValueChange,
}: {
  initial?: number
  min?: number
  max?: number
  bulk?: boolean
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
      bulk={bulk}
    />
  )
}

describe('QuantitySelector', () => {
  /**
   * O `+4` (26/09).
   *
   * Pedido do dono do produto: quem cadastra coleção grande tocava `+` quatro
   * vezes por carta. Quatro é o playset — o que se tem de uma carta para poder
   * jogar com ela —, e não um número redondo qualquer.
   *
   * Ele é **opcional**: só entra nas telas onde o gesto é cadastrar carta. Onde
   * a quantidade significa outra coisa — alocar entre locais, montar troca —,
   * quatro não quer dizer nada.
   */
  describe('o +4', () => {
    it('nao aparece sem pedir', () => {
      render(<Harness />)

      expect(screen.queryByRole('button', { name: /Acrescentar 4/ })).not.toBeInTheDocument()
    })

    it('soma o playset de uma vez', async () => {
      const onValueChange = vi.fn()
      render(<Harness initial={1} bulk onValueChange={onValueChange} />)

      await userEvent.click(screen.getByRole('button', { name: 'Acrescentar 4 a Quantidade' }))

      expect(onValueChange).toHaveBeenLastCalledWith(5)
    })

    /* Respeita o teto como o `+`: somar 4 nao pode furar o maximo. */
    it('nao passa do maximo', async () => {
      const onValueChange = vi.fn()
      render(<Harness initial={2} max={4} bulk onValueChange={onValueChange} />)

      await userEvent.click(screen.getByRole('button', { name: 'Acrescentar 4 a Quantidade' }))

      expect(onValueChange).toHaveBeenLastCalledWith(4)
    })

    it('desabilita quando ja esta no teto', () => {
      render(<Harness initial={4} max={4} bulk />)

      expect(screen.getByRole('button', { name: 'Acrescentar 4 a Quantidade' })).toBeDisabled()
    })
  })

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
