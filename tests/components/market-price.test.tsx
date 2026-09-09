import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarketPricePanel } from '@/components/catalog/market-price'
import type { MarketPrice } from '@/server/application/prices'

/**
 * O painel de preço.
 *
 * O que se protege aqui é o que a tela **diz**, não como ela é: que o dólar
 * seja lido como dólar, que o real venha com a taxa que o produziu, e que
 * "atualizado hoje" só apareça quando for hoje. Um campo de dinheiro que
 * engana vale menos que um campo vazio.
 *
 * O relógio é fixado porque "hoje" e "ontem" são calculados contra ele: sem
 * isso, o arquivo passaria hoje e falharia amanhã.
 */

const AGORA = new Date('2026-09-09T12:00:00-03:00')

const precoEmDolar = (value: number): MarketPrice => ({
  value,
  since: new Date('2026-08-12T15:00:00Z'),
  currency: 'USD',
  brl: null,
})

const comReal = (value: number, brl: number, rate: number): MarketPrice => ({
  ...precoEmDolar(value),
  brl: { value: brl, rate, rateDate: new Date('2026-09-08T00:00:00Z') },
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(AGORA)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('o valor', () => {
  it('mostra o dólar como dólar americano', () => {
    render(<MarketPricePanel price={precoEmDolar(12.5)} variantType="Normal" />)

    expect(screen.getByText('$12.50')).toBeInTheDocument()
  })

  it('mostra o real ao lado do dólar', () => {
    render(<MarketPricePanel price={comReal(12.5, 64.07, 5.1253)} variantType="Normal" />)

    expect(screen.getByText('$12.50')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s?64,07/)).toBeInTheDocument()
  })

  /** Sem a taxa escrita, o número em real vira uma afirmação sobre o Brasil. */
  it('diz por quanto converteu, e de que dia é a cotação', () => {
    render(<MarketPricePanel price={comReal(12.5, 64.07, 5.1253)} variantType="Normal" />)

    expect(screen.getByText(/Dólar a R\$\s?5,13/)).toBeInTheDocument()
    expect(screen.getByText(/PTAX do Banco Central de 08\/09/)).toBeInTheDocument()
  })

  /** Converter por taxa velha seria apresentar palpite com cara de dado. */
  it('mostra só o dólar quando não há cotação utilizável', () => {
    render(<MarketPricePanel price={precoEmDolar(12.5)} variantType="Normal" />)

    expect(screen.getByText('$12.50')).toBeInTheDocument()
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument()
  })
})

describe('o aviso de origem e frescor', () => {
  it('diz "hoje" quando a conferência foi hoje', () => {
    render(
      <MarketPricePanel
        price={precoEmDolar(1)}
        variantType="Normal"
        freshness={{ checkedAt: new Date('2026-09-09T04:00:00-03:00'), sourceUpdatedAt: null }}
      />,
    )

    expect(screen.getByText(/Fonte: TCGplayer\. Atualizado hoje às 04:00/)).toBeInTheDocument()
  })

  /**
   * O espelho publica às 17:00 e a importação roda de madrugada, então o dado
   * do mercado é do dia anterior. Calar isso faria "atualizado hoje às 04:00"
   * parecer uma leitura do mercado naquele instante.
   */
  it('separa a nossa conferência da data do dado do mercado', () => {
    render(
      <MarketPricePanel
        price={precoEmDolar(1)}
        variantType="Normal"
        freshness={{
          checkedAt: new Date('2026-09-09T04:00:00-03:00'),
          sourceUpdatedAt: new Date('2026-09-08T20:06:11Z'),
        }}
      />,
    )

    expect(screen.getByText(/dados do mercado de 08\/09/)).toBeInTheDocument()
  })

  /** No dia em que a importação não roda, é quando a data importa mais. */
  it('mostra a data quando a conferência não foi hoje nem ontem', () => {
    render(
      <MarketPricePanel
        price={precoEmDolar(1)}
        variantType="Normal"
        freshness={{ checkedAt: new Date('2026-09-01T04:00:00-03:00'), sourceUpdatedAt: null }}
      />,
    )

    expect(screen.getByText(/Atualizado em 01\/09/)).toBeInTheDocument()
    expect(screen.queryByText(/hoje/)).not.toBeInTheDocument()
  })

  it('diz "ontem" em vez da data quando foi ontem', () => {
    render(
      <MarketPricePanel
        price={precoEmDolar(1)}
        variantType="Normal"
        freshness={{ checkedAt: new Date('2026-09-08T04:00:00-03:00'), sourceUpdatedAt: null }}
      />,
    )

    expect(screen.getByText(/Atualizado ontem às 04:00/)).toBeInTheDocument()
  })

  /** Quem olha uma paralela sem valor também precisa saber de onde vem preço. */
  it('aparece mesmo sem preço nenhum', () => {
    render(<MarketPricePanel price={null} variantType="Parallel" />)

    expect(screen.getByText(/Fonte: TCGplayer/)).toBeInTheDocument()
  })
})

describe('sem cotação', () => {
  /**
   * A fonte distingue as artes pelo nome do produto e o nosso catálogo só
   * separa Normal de Parallel: não há como dizer qual paralela é qual.
   */
  it('explica que paralela ainda não tem preço', () => {
    render(<MarketPricePanel price={null} variantType="Parallel" />)

    expect(screen.getByText(/paralelas ainda não têm preço/i)).toBeInTheDocument()
  })

  it('diz que a arte comum não tem cotação, em vez de sumir', () => {
    render(<MarketPricePanel price={null} variantType="Normal" />)

    expect(screen.getByRole('heading', { name: 'Preço de mercado' })).toBeInTheDocument()
    expect(screen.getByText(/sem cotação na fonte/i)).toBeInTheDocument()
  })

  it('não inventa valor nenhum', () => {
    render(<MarketPricePanel price={null} variantType="Normal" />)

    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  })
})
