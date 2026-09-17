import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorScreen } from '@/components/layout/error-screen'

/** A tela de erro (decisão 092): código para relatar, e um jeito de sair dali. */

describe('ErrorScreen', () => {
  it('mostra o código do erro e o suporte, e nunca a mensagem do erro', () => {
    const erro = Object.assign(new Error('relation "users" does not exist'), { digest: '1684296678' })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ErrorScreen error={erro} reset={vi.fn()} />)

    expect(screen.getByText('Código: 1684296678')).toBeInTheDocument()
    expect(screen.getByText(/suporte@colexa.com.br/)).toBeInTheDocument()
    expect(screen.queryByText(/relation "users"/)).toBeNull()
    // O erro vai para o console: é o que aparece no log do servidor e do navegador.
    expect(log).toHaveBeenCalledWith(erro)
    log.mockRestore()
  })

  it('tentar de novo chama o reset do Next', async () => {
    const reset = vi.fn()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorScreen error={new Error('x')} reset={reset} />)

    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(reset).toHaveBeenCalledOnce()
    log.mockRestore()
  })
})
