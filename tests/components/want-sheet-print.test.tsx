import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WantSheetPrint } from '@/components/wants/want-sheet-print'
import type { WantView } from '@/server/application/wants'

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
    await userEvent.click(screen.getByRole('button', { name: /baixar pdf/i }))

    expect(print).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  /** Sem a instrucao, o dialogo de impressao parece o botao errado. */
  it('diz onde escolher salvar como PDF', () => {
    render(<WantSheetPrint wants={[want()]} />)

    expect(screen.getByText(/salvar como pdf/i)).toBeInTheDocument()
  })
})
