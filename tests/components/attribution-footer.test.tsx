import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AttributionFooter } from '@/components/legal/attribution-footer'

/**
 * A atribuição da decisão 020, no rodapé de toda tela (decisão 100). Um
 * componente só serve a todas as molduras, então testar o texto aqui cobre
 * todas.
 *
 * O texto mudou em 18/09: o dono do produto escreveu as duas frases, e elas
 * substituíram as anteriores ("Dados de cartas do site oficial... O ColeXa não
 * tem vínculo, parceria ou endosso da Bandai.").
 */
describe('AttributionFooter', () => {
  it('diz que a ColeXa é independente e de onde vêm os dados', () => {
    render(<AttributionFooter />)

    expect(
      screen.getByText(/não é afiliada, patrocinada ou endossada pela Bandai Namco Entertainment/),
    ).toBeInTheDocument()
    expect(screen.getByText(/disponibilizadas publicamente pelo site oficial do One Piece Card Game/)).toBeInTheDocument()
  })

  it('credita os titulares dos direitos', () => {
    render(<AttributionFooter />)

    expect(
      screen.getByText(
        'One Piece © Eiichiro Oda/Shueisha. © Toei Animation. One Piece Card Game © Bandai Namco Entertainment Inc.',
      ),
    ).toBeInTheDocument()
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
