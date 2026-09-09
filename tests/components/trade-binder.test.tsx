import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TradeBinder, TradeBinderSummary } from '@/components/trades/trade-binder'
import type { TradeBinderCard } from '@/server/application/trades'

/**
 * O Trade Binder na tela (tela 31).
 *
 * O que se protege aqui e o que a tela **diz**. "Trade Binder" sugere um lugar
 * onde as cartas ficam reservadas, e nao e: estar la significa disponivel, nao
 * comprometido com ninguem (regra 4.2). O nome sozinho engana, entao a tela
 * precisa desdizer.
 */

const carta = (over: Partial<TradeBinderCard> = {}): TradeBinderCard => ({
  variantId: '1',
  cardCode: 'OP01-001',
  cardName: 'Roronoa Zoro',
  rarity: 'SR',
  variantType: 'Normal',
  imageUrl: null,
  quantity: 3,
  locationCount: 1,
  ownedQuantity: 4,
  ...over,
})

describe('o resumo', () => {
  it('conta cartas e copias em separado', () => {
    render(<TradeBinderSummary cards={2} copies={5} />)

    expect(screen.getByText(/2 cartas · 5 cópias/)).toBeInTheDocument()
  })

  it('usa singular quando e uma so', () => {
    render(<TradeBinderSummary cards={1} copies={1} />)

    expect(screen.getByText(/1 carta · 1 cópia/)).toBeInTheDocument()
  })

  /** Sem isto o nome da tela promete uma reserva que nao existe. */
  it('diz que estar aqui nao reserva nada', () => {
    render(<TradeBinderSummary cards={2} copies={5} />)

    expect(screen.getByText(/não reserva nada/i)).toBeInTheDocument()
  })

  it('some quando nao ha nada, para o vazio falar sozinho', () => {
    const { container } = render(<TradeBinderSummary cards={0} copies={0} />)

    expect(container.innerHTML).toBe('')
  })
})

describe('o vazio', () => {
  /**
   * Nao se monta o Trade Binder aqui: ele e a soma dos locais de troca. O vazio
   * precisa dizer isso, senao a pessoa procura um botao de adicionar que nao
   * existe nesta tela.
   */
  it('explica de onde as cartas vem, e leva para la', () => {
    render(<TradeBinder cards={[]} />)

    expect(screen.getByText(/finalidade de troca/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver meus binders/i })).toHaveAttribute(
      'href',
      '/binders',
    )
  })
})

describe('a lista', () => {
  /*
   * As consultas vao pelo link, e nao por texto: sem arte, o `CardTile` repete
   * o codigo como texto alternativo da imagem, e `getByText` acha os dois.
   */
  it('mostra a quantidade disponivel de cada carta', () => {
    render(<TradeBinder cards={[carta()]} />)

    expect(screen.getByRole('link', { name: /OP01-001/ })).toBeInTheDocument()
    expect(screen.getByText('x3')).toBeInTheDocument()
  })

  /**
   * Muda o que acontece ao concluir um trade: espalhadas, a regra 4.6 manda
   * perguntar de onde saem. Quem ve antes nao e pego de surpresa depois.
   */
  it('avisa quando as copias estao em mais de um local', () => {
    render(<TradeBinder cards={[carta({ locationCount: 2 })]} />)

    expect(screen.getByText('em 2 locais')).toBeInTheDocument()
  })

  it('nao polui com o aviso quando estao num local so', () => {
    render(<TradeBinder cards={[carta({ locationCount: 1 })]} />)

    expect(screen.queryByText(/em \d+ locais/)).not.toBeInTheDocument()
  })

  it('leva para a carta ao tocar', () => {
    render(<TradeBinder cards={[carta({ variantId: '42' })]} />)

    expect(screen.getByRole('link', { name: /OP01-001/ })).toHaveAttribute(
      'href',
      '/catalogo/carta/42',
    )
  })
})

describe('a busca', () => {
  const cards = [
    carta({ variantId: '1', cardCode: 'OP01-001', cardName: 'Roronoa Zoro' }),
    carta({ variantId: '2', cardCode: 'OP01-016', cardName: 'Nami' }),
  ]

  it('filtra por nome', async () => {
    render(<TradeBinder cards={cards} />)

    await userEvent.type(screen.getByRole('searchbox'), 'nami')

    expect(screen.getByRole('link', { name: /OP01-016/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /OP01-001/ })).not.toBeInTheDocument()
  })

  it('filtra por codigo', async () => {
    render(<TradeBinder cards={cards} />)

    await userEvent.type(screen.getByRole('searchbox'), 'OP01-001')

    expect(screen.getByRole('link', { name: /OP01-001/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /OP01-016/ })).not.toBeInTheDocument()
  })

  /** O vazio da busca e outro problema que o vazio do binder, e diz outra coisa. */
  it('distingue "nada nesta busca" de "nada disponivel"', async () => {
    render(<TradeBinder cards={cards} />)

    await userEvent.type(screen.getByRole('searchbox'), 'zzzz')

    expect(screen.getByText(/nada nesta busca/i)).toBeInTheDocument()
    expect(screen.queryByText(/nada disponível para troca/i)).not.toBeInTheDocument()
  })
})
