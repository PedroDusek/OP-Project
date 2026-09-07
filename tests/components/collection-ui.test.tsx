import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CollectionGrid, type CollectionCardView } from '@/components/collection/collection-grid'
import { PlaysetList } from '@/components/collection/playset-list'
import { AddToCollection } from '@/components/collection/add-to-collection'
import { ToastProvider } from '@/components/ui/toast'
import type { PlaysetRow } from '@/server/application/collection/read-collection'

/*
 * A acao de servidor arrasta o Prisma no grafo de modulos. No Next ela vira uma
 * referencia e nao chega ao navegador; no jsdom, e importada de verdade.
 */
const setQuantityAction = vi.hoisted(() =>
  vi.fn(async (_previous: unknown, data: FormData) => ({
    status: 'saved' as const,
    quantity: Number(data.get('quantity')),
    removed: Number(data.get('quantity')) === 0,
  })),
)

vi.mock('@/app/(app)/colecao/actions', () => ({ setQuantityAction }))

afterEach(() => {
  setQuantityAction.mockClear()
})

const card = (overrides: Partial<CollectionCardView> = {}): CollectionCardView => ({
  variantId: '1',
  cardCode: 'OP01-001',
  cardName: 'Roronoa Zoro',
  rarity: 'SR',
  variantType: 'Normal',
  imageUrl: null,
  quantity: 2,
  quantityForCard: 2,
  playsetClosed: false,
  ...overrides,
})

const withToast = (ui: React.ReactNode) => render(<ToastProvider>{ui}</ToastProvider>)

describe('CollectionGrid', () => {
  it('mostra a quantidade possuida em cada carta', () => {
    withToast(<CollectionGrid items={[card({ quantity: 3 })]} />)

    expect(screen.getByText('x3')).toBeInTheDocument()
  })

  /** "Normal" e ruido; "Playset" so aparece onde significa algo. */
  it('etiqueta playset fechado, e nao a variante comum', () => {
    withToast(
      <CollectionGrid items={[card({ playsetClosed: true, quantity: 4, quantityForCard: 4 })]} />,
    )

    expect(screen.getByText('Playset')).toBeInTheDocument()
    expect(screen.queryByText('Normal')).not.toBeInTheDocument()
  })

  /**
   * Numa lista do que se tem, a pergunta seguinte quase sempre e "quantas".
   * Tocar edita, em vez de navegar para o detalhe.
   */
  it('tocar numa carta abre a edicao de quantidade', async () => {
    withToast(<CollectionGrid items={[card()]} />)

    await userEvent.click(screen.getByRole('button', { name: /OP01-001/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Editar quantidade' })
    expect(within(dialog).getByRole('textbox', { name: 'Quantidade' })).toHaveValue('2')
  })
})

describe('QuantitySheet', () => {
  async function abrir(quantity = 2) {
    withToast(<CollectionGrid items={[card({ quantity })]} />)
    await userEvent.click(screen.getByRole('button', { name: /OP01-001/ }))
    return screen.findByRole('dialog')
  }

  it('envia a quantidade escolhida', async () => {
    const dialog = await abrir(2)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Aumentar Quantidade' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))

    expect(setQuantityAction).toHaveBeenCalled()
    const data = setQuantityAction.mock.calls[0][1]
    expect(data.get('quantity')).toBe('3')
    expect(data.get('variantId')).toBe('1')
  })

  /**
   * A quantidade viaja no valor do proprio botao. Zerar pelo estado e submeter
   * seria uma corrida: `setState` e assincrono, e o envio sairia com o valor
   * anterior.
   */
  it('remover envia zero, sem depender do estado', async () => {
    const dialog = await abrir(2)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Remover da coleção' }))

    expect(setQuantityAction.mock.calls[0][1].get('quantity')).toBe('0')
  })

  it('para quem ainda nao tem a carta, o painel se chama adicionar', async () => {
    withToast(
      <AddToCollection
        variantId="7"
        code="OP01-002"
        name="Nami"
        imageUrl={null}
        currentQuantity={0}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /Adicionar à coleção/ }))

    expect(await screen.findByRole('dialog', { name: 'Adicionar à coleção' })).toBeInTheDocument()
  })

  /**
   * Decisao 007: reduzir abaixo do alocado devolve onde as copias estao, em vez
   * de desalocar sozinho ou dar erro seco.
   */
  it('mostra os locais quando o servidor recusa a reducao', async () => {
    setQuantityAction.mockResolvedValueOnce({
      status: 'conflict',
      message: 'Você tem 4 cópias guardadas.',
      currentQuantity: 4,
      requestedQuantity: 2,
      allocations: [
        { storageLocationId: '1', storageName: 'Binder Principal', quantity: 3 },
        { storageLocationId: '2', storageName: 'Caixa Troca', quantity: 1 },
      ],
    } as never)

    const dialog = await abrir(4)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('Você tem 4 cópias guardadas.')
    expect(alerta).toHaveTextContent('Binder Principal')
    expect(alerta).toHaveTextContent('Caixa Troca')
  })
})

describe('PlaysetList', () => {
  const row = (overrides: Partial<PlaysetRow> = {}): PlaysetRow => ({
    cardCode: 'OP01-001',
    cardName: 'Roronoa Zoro',
    cardType: 'Character',
    imageUrl: null,
    quantity: 4,
    closed: true,
    ...overrides,
  })

  it('anuncia a contagem real, e nao a porcentagem', () => {
    render(<PlaysetList rows={[row({ quantity: 3, closed: false })]} />)

    expect(screen.getByRole('progressbar', { name: /OP01-001/ })).toHaveAttribute(
      'aria-valuetext',
      '3 de 4',
    )
  })

  /**
   * O playset e binario por carta: oito copias continuam sendo um. Uma barra em
   * 200% diria que ha algo a mais para alcancar.
   */
  it('nao passa de quatro na barra com copias sobrando', () => {
    render(<PlaysetList rows={[row({ quantity: 8 })]} />)

    const barra = screen.getByRole('progressbar', { name: /OP01-001/ })
    expect(barra).toHaveAttribute('aria-valuenow', '4')
    expect(barra).toHaveAttribute('aria-valuemax', '4')
  })

  /**
   * Cada linha nomeia o codigo duas vezes — no texto e no lugar da arte que nao
   * carregou —, entao a lista e lida pelas barras de progresso, que existem uma
   * por carta.
   */
  const listados = () =>
    screen
      .queryAllByRole('progressbar')
      .map((bar) => bar.getAttribute('aria-label')?.replace('Playset de ', ''))

  it('separa completos de incompletos', async () => {
    render(
      <PlaysetList
        rows={[
          row({ cardCode: 'OP01-001', quantity: 4, closed: true }),
          row({ cardCode: 'OP01-002', quantity: 1, closed: false }),
        ]}
      />,
    )

    await userEvent.click(screen.getByRole('tab', { name: /^Completos/ }))
    expect(listados()).toEqual(['OP01-001'])

    await userEvent.click(screen.getByRole('tab', { name: /^Incompletos/ }))
    expect(listados()).toEqual(['OP01-002'])
  })

  it('busca por codigo e por nome', async () => {
    render(
      <PlaysetList
        rows={[
          row({ cardCode: 'OP01-001', cardName: 'Zoro' }),
          row({ cardCode: 'OP01-002', cardName: 'Nami' }),
        ]}
      />,
    )

    const busca = screen.getByRole('searchbox', { name: 'Buscar nos playsets' })

    await userEvent.type(busca, 'nami')
    expect(listados()).toEqual(['OP01-002'])

    await userEvent.clear(busca)
    await userEvent.type(busca, 'op01-001')
    expect(listados()).toEqual(['OP01-001'])
  })
})

describe('resolucao da decisao 007', () => {
  const CONFLITO = {
    status: 'conflict',
    message: 'Você tem 4 cópias guardadas.',
    currentQuantity: 4,
    requestedQuantity: 2,
    allocations: [
      { storageLocationId: '1', storageName: 'Binder Principal', quantity: 3 },
      { storageLocationId: '2', storageName: 'Caixa Troca', quantity: 1 },
    ],
  }

  /** Abre com 4, reduz para 2 e recebe o conflito do servidor. */
  async function ateOConflito() {
    setQuantityAction.mockResolvedValueOnce(CONFLITO as never)
    withToast(<CollectionGrid items={[card({ quantity: 4, quantityForCard: 4 })]} />)

    await userEvent.click(screen.getByRole('button', { name: /OP01-001/ }))
    const dialog = await screen.findByRole('dialog')

    const diminuir = within(dialog).getByRole('button', { name: 'Diminuir Quantidade' })
    await userEvent.click(diminuir)
    await userEvent.click(diminuir)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await screen.findByRole('alert')

    return dialog
  }

  /**
   * Nenhuma retirada vem preenchida: escolher a ordem — tirar do maior, tirar
   * do primeiro — seria presumir de onde as cartas sairam.
   */
  it('nao escolhe de onde as copias saem', async () => {
    const dialog = await ateOConflito()

    expect(within(dialog).getByRole('textbox', { name: 'Retirar de Binder Principal' })).toHaveValue(
      '0',
    )
    expect(within(dialog).getByRole('textbox', { name: 'Retirar de Caixa Troca' })).toHaveValue('0')
  })

  it('diz quantas copias ainda faltam sair', async () => {
    const dialog = await ateOConflito()

    expect(within(dialog).getByText('Escolha de onde saem mais 2.')).toBeInTheDocument()
  })

  it('so libera o envio quando a conta fecha', async () => {
    const dialog = await ateOConflito()
    const enviar = within(dialog).getByRole('button', { name: 'Reduzir e retirar' })
    expect(enviar).toBeDisabled()

    const mais = within(dialog).getByRole('button', { name: 'Aumentar Retirar de Binder Principal' })
    await userEvent.click(mais)
    expect(enviar).toBeDisabled()

    await userEvent.click(mais)
    expect(enviar).toBeEnabled()
  })

  /** Retirada e nova quantidade vao juntas: sao uma operacao so. */
  it('envia as retiradas junto com a nova quantidade', async () => {
    const dialog = await ateOConflito()
    const mais = within(dialog).getByRole('button', { name: 'Aumentar Retirar de Binder Principal' })

    await userEvent.click(mais)
    await userEvent.click(mais)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reduzir e retirar' }))

    const enviado = setQuantityAction.mock.calls[1][1]
    expect(enviado.get('quantity')).toBe('2')
    expect(enviado.getAll('remocao')).toEqual(['1:2'])
  })

  /** O controle nao oferece retirar mais do que ha naquele local. */
  it('nao deixa retirar mais do que o local tem', async () => {
    const dialog = await ateOConflito()
    const mais = within(dialog).getByRole('button', { name: 'Aumentar Retirar de Caixa Troca' })

    await userEvent.click(mais)

    expect(mais).toBeDisabled()
    expect(within(dialog).getByRole('textbox', { name: 'Retirar de Caixa Troca' })).toHaveValue('1')
  })
})
