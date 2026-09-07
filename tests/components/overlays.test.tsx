import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sheet } from '@/components/ui/sheet'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { ToastProvider, useToast } from '@/components/ui/toast'

function SheetHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Adicionar</Button>
      <Sheet open={open} onOpenChange={setOpen} title="Adicionar à coleção">
        <p>Conteúdo do painel</p>
      </Sheet>
    </>
  )
}

describe('Sheet', () => {
  it('abre com nome acessivel e fecha pelo botao', async () => {
    render(<SheetHarness />)

    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    const dialog = screen.getByRole('dialog', { name: 'Adicionar à coleção' })
    expect(dialog).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('fecha com Esc', async () => {
    render(<SheetHarness />)

    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  /**
   * Um titulo escondido continua sendo o nome acessivel do dialogo. Sem ele, o
   * leitor de tela anuncia so "dialogo", que nao diz o que abriu.
   */
  it('mantem o nome acessivel com o titulo escondido', () => {
    render(
      <Sheet open onOpenChange={vi.fn()} title="Filtros do catálogo" hideTitle>
        <p>Filtros</p>
      </Sheet>,
    )

    expect(screen.getByRole('dialog', { name: 'Filtros do catálogo' })).toBeInTheDocument()
  })
})

describe('ConfirmDialog', () => {
  it('confirma a acao destrutiva', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Excluir o Binder Principal?"
        description="Não dá para desfazer."
        confirmLabel="Excluir local"
        onConfirm={onConfirm}
      />,
    )

    expect(screen.getByRole('alertdialog', { name: 'Excluir o Binder Principal?' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Excluir local' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('cancelar nao dispara a acao', async () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Excluir?"
        description="Não dá para desfazer."
        onConfirm={onConfirm}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

function ToastHarness() {
  const { toast } = useToast()
  return (
    <Button onClick={() => toast({ title: 'Coleção atualizada', tone: 'success' })}>Salvar</Button>
  )
}

describe('Toast', () => {
  it('mostra o feedback depois da acao', async () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Coleção atualizada')).toBeInTheDocument()
  })

  it('exige o provedor', () => {
    // O erro e proposital: um toast que some em silencio por falta de provedor
    // seria descoberto so quando alguem precisasse do aviso.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ToastHarness />)).toThrow(/ToastProvider/)
    vi.restoreAllMocks()
  })
})
