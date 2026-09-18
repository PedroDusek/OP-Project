import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AttributionFooter } from '@/components/legal/attribution-footer'

/**
 * A atribuição da decisão 020, no rodapé de toda tela (pedido do dono do
 * produto em 18/09). Um componente só serve a todas as molduras, então testar
 * o texto aqui cobre todas.
 */
describe('AttributionFooter', () => {
  it('diz de onde vêm os dados e que não há vínculo com a Bandai', () => {
    render(<AttributionFooter />)

    expect(screen.getByText(/dados de cartas do site oficial do one piece card game/i)).toBeInTheDocument()
    expect(screen.getByText(/não tem vínculo, parceria ou endosso da bandai/i)).toBeInTheDocument()
  })

  /* A 020 pede o crédito aos três titulares, e ele faltava até 18/09. */
  it('credita os titulares dos direitos', () => {
    render(<AttributionFooter />)

    expect(screen.getByText(/© Eiichiro Oda\/Shueisha, Toei Animation/)).toBeInTheDocument()
    expect(screen.getByText(/© Bandai Namco Entertainment/)).toBeInTheDocument()
  })

  it('vira div dentro de outro rodapé, que não pode conter footer', () => {
    const { container } = render(
      <footer>
        <AttributionFooter as="div" />
      </footer>,
    )

    expect(container.querySelectorAll('footer')).toHaveLength(1)
  })
})
