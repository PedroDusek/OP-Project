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

/**
 * O viewport do toast nao pode engolir toque.
 *
 * Ele e um elemento fixo com espacamento proprio: sem nenhum toast dentro,
 * continuava sendo um retangulo invisivel sobre a faixa inferior da tela. No
 * celular isso cobria a barra de navegacao, o botao de carregar mais e os
 * controles de tema — os toques nao chegavam a nada ali embaixo.
 */
describe('Toast, a faixa invisivel', () => {
  const viewport = () => document.querySelector('ol')

  it('o viewport nao recebe toque', () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    )

    const alvo = viewport()
    expect(alvo).not.toBeNull()
    expect(alvo!.className).toContain('pointer-events-none')
  })

  it('o cartao recebe toque, para dar para dispensar', async () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    const cartao = (await screen.findByText('Coleção atualizada')).closest('li')
    expect(cartao).not.toBeNull()
    expect(cartao!.className).toContain('pointer-events-auto')
  })

  /**
   * No celular o rodape e onde ficam o polegar, a navegacao e a acao principal
   * de quase toda tela. Mesmo sem capturar toque, um cartao ali tapa o que a
   * pessoa acabou de usar.
   */
  it('fica no topo, e nao sobre a barra de navegacao', () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    )

    const alvo = viewport()!
    expect(alvo.className).toContain('top-0')
    expect(alvo.className).not.toContain('bottom-0')
  })
})
