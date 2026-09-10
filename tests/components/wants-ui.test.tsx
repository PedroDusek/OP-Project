import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WantList } from '@/components/wants/want-list'
import { WantButton } from '@/components/wants/want-sheet'
import { ToastProvider } from '@/components/ui/toast'
import type { WantView } from '@/server/application/wants'

/*
 * A acao de servidor arrasta o Prisma no grafo de modulos. No Next ela vira
 * referencia e nao chega ao navegador; no jsdom, e importada de verdade.
 */
const setWantAction = vi.hoisted(() =>
  vi.fn(async (_previous: unknown, data: FormData) => ({
    status: 'saved' as const,
    quantity: Number(data.get('quantity')),
    removed: Number(data.get('quantity')) === 0,
  })),
)

vi.mock('@/app/(app)/colecao/actions', () => ({
  setWantAction,
  setQuantityAction: vi.fn(async () => ({ status: 'idle' })),
}))

const pathname = { value: '/colecao' }
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }))

afterEach(() => {
  setWantAction.mockClear()
  pathname.value = '/colecao'
})

const withToast = (ui: React.ReactNode) => render(<ToastProvider>{ui}</ToastProvider>)

const want = (overrides: Partial<WantView> = {}): WantView => ({
  variantId: '1',
  cardCode: 'OP01-001',
  cardName: 'Roronoa Zoro',
  rarity: 'SR',
  variantType: 'Normal',
  imageUrl: null,
  sheetImageUrl: null,
  wanted: 4,
  owned: 1,
  remaining: 3,
  status: 'partial',
  ...overrides,
})

describe('WantList', () => {
  /**
   * O que a lista responde e "o que ainda falta". So o numero desejado diria
   * quanto se quer sem dizer quanto falta — e e o que falta que faz alguem sair
   * de casa atras da carta.
   */
  it('mostra possuidas sobre desejadas', () => {
    withToast(<WantList wants={[want({ owned: 1, wanted: 4 })]} />)

    expect(screen.getByText('1/4')).toBeInTheDocument()
  })

  it('separa o que ainda falta do que ja foi conseguido', async () => {
    withToast(
      <WantList
        wants={[
          want({ variantId: '1', cardCode: 'OP01-001', status: 'partial' }),
          want({ variantId: '2', cardCode: 'OP01-002', status: 'satisfied', owned: 4 }),
        ]}
      />,
    )

    await userEvent.click(screen.getByRole('tab', { name: /^Ainda faltam/ }))

    const cartas = screen.getAllByRole('button').filter((b) => b.textContent?.includes('OP01-'))
    expect(cartas).toHaveLength(1)
    expect(cartas[0]).toHaveTextContent('OP01-001')
  })

  it('busca por codigo e por nome', async () => {
    withToast(
      <WantList
        wants={[
          want({ variantId: '1', cardCode: 'OP01-001', cardName: 'Zoro' }),
          want({ variantId: '2', cardCode: 'OP01-002', cardName: 'Nami' }),
        ]}
      />,
    )

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar na want list' }), 'nami')

    const cartas = screen.getAllByRole('button').filter((b) => b.textContent?.includes('OP01-'))
    expect(cartas).toHaveLength(1)
    expect(cartas[0]).toHaveTextContent('OP01-002')
  })

  /** Numa lista de desejos, a pergunta seguinte e sempre "quantas". */
  it('tocar numa carta edita quantas se quer', async () => {
    withToast(<WantList wants={[want({ wanted: 4 })]} />)

    await userEvent.click(screen.getByRole('button', { name: /OP01-001/ }))

    const painel = await screen.findByRole('dialog', { name: 'Quantas você quer' })
    expect(within(painel).getByRole('textbox', { name: 'Quero na minha coleção' })).toHaveValue('4')
  })

  it('o vazio explica como comecar', () => {
    withToast(<WantList wants={[]} />)

    expect(screen.getByText('Sua want list está vazia')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir o catálogo' })).toBeInTheDocument()
  })
})

describe('WantSheet', () => {
  const abrir = async (currentQuantity = 0, owned = 0) => {
    withToast(
      <WantButton
        variantId="1"
        code="OP01-001"
        name="Roronoa Zoro"
        imageUrl={null}
        currentQuantity={currentQuantity}
        owned={owned}
      />,
    )
    // Sem want, o nome acessivel do botao e "Adicionar a want list"; com want,
    // e "Quero N, editar".
    await userEvent.click(screen.getByRole('button', { name: /Quero|want list/ }))
    return screen.findByRole('dialog')
  }

  /** Partir de zero pediria um toque a mais para o caso normal. */
  it('quem ainda nao quer abre em 1', async () => {
    const painel = await abrir(0)

    expect(within(painel).getByRole('textbox', { name: 'Quero na minha coleção' })).toHaveValue('1')
  })

  it('envia a quantidade escolhida', async () => {
    const painel = await abrir(2)

    await userEvent.click(
      within(painel).getByRole('button', { name: 'Aumentar Quero na minha coleção' }),
    )
    await userEvent.click(within(painel).getByRole('button', { name: 'Salvar' }))

    const enviado = setWantAction.mock.calls[0][1]
    expect(enviado.get('variantId')).toBe('1')
    expect(enviado.get('quantity')).toBe('3')
  })

  /** Querer zero e sair da lista: e a mesma escrita, nao uma segunda acao. */
  it('tirar da lista envia zero', async () => {
    const painel = await abrir(2)

    await userEvent.click(within(painel).getByRole('button', { name: 'Tirar da want list' }))

    expect(setWantAction.mock.calls[0][1].get('quantity')).toBe('0')
  })

  it('diz o estado do want, contando o que ja se tem', async () => {
    const painel = await abrir(4, 2)

    expect(within(painel).getByText(/Tenho algumas · você tem 2/)).toBeInTheDocument()
  })

  /** Nao existe prioridade nem anotacao nesta versao (`business-rules.md` 4.4). */
  it('nao oferece anotacao', async () => {
    const painel = await abrir(1)

    expect(within(painel).queryByRole('textbox', { name: /anota/i })).not.toBeInTheDocument()
  })
})
