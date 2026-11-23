import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * Compartilhar a decklist como imagem (pedido do dono do produto em 23/11).
 *
 * O `canvas` não existe no jsdom, então o desenho é trocado por um dublê — o
 * que se protege aqui é a **ligação**: o toque abre o painel, o painel carrega
 * a lista daquele id, desenha e oferece o arquivo.
 *
 * A forma da folha está em `deck-sheet-image.test.ts`; a regra de quem pode
 * compartilhar, em `deck-list.test.tsx`.
 */

const { carregarDeckAction } = vi.hoisted(() => ({ carregarDeckAction: vi.fn() }))
vi.mock('@/app/(app)/deck/actions', () => ({ carregarDeckAction }))

const deck = {
  id: '3',
  name: 'Sabo Vermelho',
  leader: {
    variantId: '70',
    cardCode: 'OP13-004',
    cardName: 'Sabo',
    variantType: 'Normal',
    imageUrl: null,
    type: 'Leader',
    cost: null,
    sheetImageUrl: 'https://cdn/70_in_1000x1000.jpg',
    colors: ['Vermelho'],
  },
  lines: [
    {
      variantId: '81',
      cardCode: 'OP17-080',
      cardName: 'Usopp',
      variantType: 'Normal',
      imageUrl: null,
      type: 'Character',
      cost: 3,
      sheetImageUrl: null,
      copies: 4,
    },
  ],
}

afterEach(() => {
  /*
   * A limpeza antes de desfazer os dubles, e nao depois: o desmonte chama
   * `URL.revokeObjectURL`, e com o `URL` ja restaurado o jsdom nao tem esse
   * metodo. Era isto que derrubava dois testes aqui.
   */
  cleanup()
  carregarDeckAction.mockReset()
  vi.unstubAllGlobals()
})

async function montar(render_: ReturnType<typeof vi.fn>) {
  vi.doMock('@/lib/deck-sheet-image', () => ({ renderDeckSheet: render_ }))
  vi.resetModules()

  const { ShareDeck } = await import('@/components/decks/share-deck')
  // `resetModules` cria um grafo novo: o provider tem de vir dele, senao o
  // componente le um contexto que ninguem forneceu.
  const { ToastProvider: Provider } = await import('@/components/ui/toast')
  vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => {} })

  render(
    <Provider>
      <ShareDeck id="3" name="Sabo Vermelho" />
    </Provider>,
  )
}

describe('compartilhar a decklist', () => {
  it('o botão se anuncia pelo nome da lista, e não abre nada antes do toque', async () => {
    await montar(vi.fn())

    expect(screen.getByRole('button', { name: 'Compartilhar Sabo Vermelho' })).toBeInTheDocument()
    expect(carregarDeckAction).not.toHaveBeenCalled()
  })

  /*
   * A lista so e buscada quando alguem quis compartilhar: a tela `/deck` lista
   * varias, e preparar todas seria baixar centenas de artes para compartilhar,
   * quase sempre, nenhuma.
   */
  it('o toque carrega aquela lista e desenha a imagem', async () => {
    carregarDeckAction.mockResolvedValue({ status: 'ok', deck })
    const render_ = vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }))
    await montar(render_)

    await userEvent.click(screen.getByRole('button', { name: 'Compartilhar Sabo Vermelho' }))

    await waitFor(() => expect(carregarDeckAction).toHaveBeenCalledWith('3'))
    await waitFor(() => expect(render_).toHaveBeenCalledTimes(1))

    const folha = render_.mock.calls[0][0]
    expect(folha.name).toBe('Sabo Vermelho')
    expect(folha.leader.cardCode).toBe('OP13-004')
    expect(folha.cards).toHaveLength(1)
    expect(folha.cards[0]).toMatchObject({ cardCode: 'OP17-080', copies: 4, cost: 3 })
  })

  it('pronta, oferece baixar e mostra a prévia do que vai ser enviado', async () => {
    carregarDeckAction.mockResolvedValue({ status: 'ok', deck })
    await montar(vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' })))

    await userEvent.click(screen.getByRole('button', { name: 'Compartilhar Sabo Vermelho' }))

    expect(await screen.findByRole('button', { name: /baixar a imagem/i })).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Prévia da imagem da decklist Sabo Vermelho' }),
    ).toHaveAttribute('src', 'blob:x')
  })

  /* A recusa do servidor chega escrita, e nao como painel vazio. */
  it('diz o motivo quando a lista não abre', async () => {
    carregarDeckAction.mockResolvedValue({
      status: 'error',
      message: 'As decklists são um recurso Premium.',
    })
    await montar(vi.fn())

    await userEvent.click(screen.getByRole('button', { name: 'Compartilhar Sabo Vermelho' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('As decklists são um recurso Premium.')
  })

  /* Desenho que falha não deixa o painel girando para sempre. */
  it('diz quando o navegador não consegue desenhar', async () => {
    carregarDeckAction.mockResolvedValue({ status: 'ok', deck })
    await montar(vi.fn().mockRejectedValue(new Error('sem canvas')))

    await userEvent.click(screen.getByRole('button', { name: 'Compartilhar Sabo Vermelho' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível preparar a imagem neste navegador.',
    )
  })
})
