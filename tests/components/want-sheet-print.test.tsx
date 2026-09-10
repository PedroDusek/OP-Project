import { describe, expect, it, vi } from 'vitest'
import { render as renderRaw, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WantSheetPrint } from '@/components/wants/want-sheet-print'
import { ToastProvider } from '@/components/ui/toast'
import type { WantView } from '@/server/application/wants'

/** A folha avisa por toast quando o desenho falha, e o aviso precisa de um lar. */
const render = (ui: React.ReactElement) => renderRaw(<ToastProvider>{ui}</ToastProvider>)

/**
 * A want list em folha.
 *
 * O PDF sai pela impressao do navegador porque a decisao 026 nao deixa copiar
 * as imagens da fonte, e desenha-las num `canvas` exigiria servi-las pelo nosso
 * dominio. O que se protege aqui e o conteudo da folha: o que entra, o que fica
 * de fora, e a quantidade — que e o dado que a folha existe para carregar.
 */

const want = (over: Partial<WantView> = {}): WantView => ({
  variantId: '1',
  cardCode: 'OP01-001',
  cardName: 'Roronoa Zoro',
  rarity: 'SR',
  variantType: 'Normal',
  imageUrl: null,
  sheetImageUrl: 'https://cdn/arte.jpg',
  wanted: 4,
  owned: 0,
  remaining: 4,
  status: 'missing',
  ...over,
})

describe('o que entra na folha', () => {
  it('mostra a carta que falta, com quantas faltam', () => {
    render(<WantSheetPrint wants={[want({ remaining: 3 })]} />)

    expect(screen.getByText('3x')).toBeInTheDocument()
    expect(screen.getByText('Roronoa Zoro')).toBeInTheDocument()
  })

  /**
   * Uma folha com o que a pessoa ja conseguiu faria alguem oferecer carta que
   * ela nao quer mais — o oposto do motivo de levar a lista.
   */
  it('deixa de fora o que a pessoa ja conseguiu', () => {
    render(
      <WantSheetPrint
        wants={[
          want({ variantId: '1', cardCode: 'OP01-001' }),
          want({ variantId: '2', cardCode: 'OP01-016', status: 'satisfied', remaining: 0 }),
        ]}
      />,
    )

    expect(screen.getByText('Roronoa Zoro')).toBeInTheDocument()
    expect(screen.queryByText('OP01-016')).not.toBeInTheDocument()
  })

  it('conta cartas e copias no cabecalho', () => {
    render(
      <WantSheetPrint
        wants={[
          want({ variantId: '1', remaining: 2 }),
          want({ variantId: '2', cardCode: 'OP01-016', remaining: 1 }),
        ]}
      />,
    )

    expect(screen.getByText(/2 cartas · 3 cópias/)).toBeInTheDocument()
  })

  /** Divulgacao: a folha vai para grupos de gente que nao conhece o produto. */
  it('leva a marca', () => {
    render(<WantSheetPrint wants={[want()]} />)

    expect(screen.getByRole('img', { name: 'ColeXa' })).toBeInTheDocument()
    expect(screen.getByText(/colexa\.com\.br/)).toBeInTheDocument()
  })
})

describe('o vazio', () => {
  it('explica quando nao ha nada faltando', () => {
    render(<WantSheetPrint wants={[want({ status: 'satisfied', remaining: 0 })]} />)

    expect(screen.getByText(/nada faltando/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /adicionar cartas/i })).toHaveAttribute(
      'href',
      '/colecao/quero/adicionar',
    )
  })
})

describe('gerar o arquivo', () => {
  it('chama a impressao do navegador', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)

    render(<WantSheetPrint wants={[want()]} />)
    await userEvent.click(screen.getByRole('button', { name: /imprimir/i }))

    expect(print).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  /** Sem a instrucao, o dialogo de impressao parece o botao errado. */
  it('diz onde escolher salvar como PDF', () => {
    render(<WantSheetPrint wants={[want()]} />)

    expect(screen.getByText(/salvar como pdf/i)).toBeInTheDocument()
  })

  it('mostra as duas saidas', () => {
    render(<WantSheetPrint wants={[want()]} />)

    expect(screen.getByRole('button', { name: /baixar imagem/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /imprimir/i })).toBeInTheDocument()
  })
})

describe('a imagem', () => {
  /**
   * O canvas nao existe no jsdom, entao o desenho e trocado por um dublê. O que
   * este teste protege e a ligacao: o botao chama o gerador com o que falta, e
   * so com o que falta.
   */
  it('gera a partir das cartas que faltam, e nao das satisfeitas', async () => {
    const render_ = vi.fn().mockResolvedValue([new Blob(['x'], { type: 'image/jpeg' })])
    vi.doMock('@/lib/want-sheet-image', () => ({
      CARDS_PER_SHEET: 12,
      renderWantSheets: render_,
    }))
    vi.resetModules()

    const { WantSheetPrint: Componente } = await import('@/components/wants/want-sheet-print')
    // `resetModules` cria um grafo novo: o provider tem de vir dele, senao o
    // componente le um contexto que ninguem forneceu.
    const { ToastProvider: Provider } = await import('@/components/ui/toast')
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => {} })

    renderRaw(
      <Provider>
        <Componente
          wants={[
            want({ variantId: '1', remaining: 2, sheetImageUrl: 'https://cdn/1.jpg' }),
            want({ variantId: '2', status: 'satisfied', remaining: 0 }),
          ]}
        />
      </Provider>,
    )
    await userEvent.click(screen.getByRole('button', { name: /baixar imagem/i }))

    expect(render_).toHaveBeenCalledWith([
      {
        cardCode: 'OP01-001',
        cardName: 'Roronoa Zoro',
        sheetImageUrl: 'https://cdn/1.jpg',
        remaining: 2,
      },
    ])

    vi.unstubAllGlobals()
    vi.doUnmock('@/lib/want-sheet-image')
  })

  /** Sem vinculo a carta nao some: sai com o codigo no lugar da arte. */
  it('avisa quantas cartas saem sem arte', () => {
    render(<WantSheetPrint wants={[want({ sheetImageUrl: null })]} />)

    expect(screen.getByText(/1 carta sai com o código no lugar da arte/i)).toBeInTheDocument()
  })
})

describe('a paginacao', () => {
  /**
   * O mesmo corte da impressao. Uma lista longa numa imagem so vira uma tira
   * que o WhatsApp recomprime ate o numero da carta borrar — e o numero e o
   * dado que a folha existe para carregar.
   */
  it('avisa quantas imagens saem quando passa de doze', () => {
    const muitas = Array.from({ length: 25 }, (_, i) =>
      want({ variantId: String(i), cardCode: `OP01-${i}` }),
    )
    render(<WantSheetPrint wants={muitas} />)

    expect(screen.getByText(/Saem 3 imagens, de até 12 cartas cada/)).toBeInTheDocument()
  })

  it('nao fala em varias imagens quando cabe numa folha', () => {
    render(<WantSheetPrint wants={[want()]} />)

    expect(screen.queryByText(/Saem \d+ imagens/)).not.toBeInTheDocument()
    expect(screen.getByText(/A imagem baixa direto/)).toBeInTheDocument()
  })
})
