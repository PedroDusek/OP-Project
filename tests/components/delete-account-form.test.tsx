import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteAccountForm } from '@/components/account/delete-account-form'

/** O formulário de excluir a conta (decisão 091). */

vi.mock('@/app/(app)/conta/actions', () => ({ requestAccountDeletionAction: vi.fn(async () => ({ status: 'idle' })) }))

describe('DeleteAccountForm', () => {
  it('o botão só acende com a palavra digitada, sem ligar para maiúsculas', async () => {
    render(<DeleteAccountForm confirmation="EXCLUIR" />)
    const botao = screen.getByRole('button', { name: 'Pedir a exclusão da conta' })
    const campo = screen.getByLabelText('Para confirmar, digite EXCLUIR')

    expect(botao).toBeDisabled()
    await userEvent.type(campo, 'exclui')
    expect(botao).toBeDisabled()
    await userEvent.type(campo, 'r')
    expect(botao).toBeEnabled()
  })
})
