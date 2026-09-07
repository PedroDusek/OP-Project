import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressBar } from '@/components/ui/progress-bar'

describe('ProgressBar', () => {
  /**
   * O leitor de tela precisa anunciar "124 de 125", nao "99%". A diferenca
   * importa porque 124/125 e 249/250 dao a mesma porcentagem e so um deles esta
   * a uma carta do fim.
   */
  it('anuncia a contagem real, nao a porcentagem', () => {
    render(<ProgressBar label="Progresso de OP01" value={124} total={125} />)

    const bar = screen.getByRole('progressbar', { name: 'Progresso de OP01' })
    expect(bar).toHaveAttribute('aria-valuenow', '124')
    expect(bar).toHaveAttribute('aria-valuemax', '125')
    expect(bar).toHaveAttribute('aria-valuetext', '124 de 125')
  })

  it('nao divide por zero num set sem variantes', () => {
    render(<ProgressBar label="Set vazio" value={0} total={0} showNumbers />)

    expect(screen.getByRole('progressbar', { name: 'Set vazio' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('limita valor acima do total', () => {
    render(<ProgressBar label="Acima" value={200} total={125} showNumbers />)

    expect(screen.getByRole('progressbar', { name: 'Acima' })).toHaveAttribute(
      'aria-valuenow',
      '125',
    )
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('mostra a contagem quando pedida', () => {
    render(<ProgressBar label="OP12" value={60} total={125} showNumbers />)

    expect(screen.getByText('60 / 125')).toBeInTheDocument()
    expect(screen.getByText('48%')).toBeInTheDocument()
  })
})
