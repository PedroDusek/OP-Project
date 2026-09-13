import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LigaWorksheetView } from '@/components/catalog/liga-worksheet'
import type { LigaWorksheet, LigaWorksheetRow } from '@/server/application/catalog'

/*
 * A acao grava um arquivo do repositorio, e a pagina le do banco e do disco. Os
 * dubles impedem um teste de componente de mexer em `data/liga-cartas.json` e
 * de puxar o Prisma para o grafo (armadilha 33).
 */
const { recordLigaCardAction, readLigaWorksheet, ligaMappingAvailable, notFound } = vi.hoisted(() => ({
  recordLigaCardAction: vi.fn(async (_previous: unknown, _data: FormData) => ({
    status: 'saved' as const,
    url: 'https://www.ligaonepiece.com.br/?view=cards/card&ed=OP-01&num=OP01-004-PAR',
  })),
  readLigaWorksheet: vi.fn(),
  ligaMappingAvailable: vi.fn(() => true),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

vi.mock('@/app/dev/liga/actions', () => ({ recordLigaCardAction }))
vi.mock('@/server/application/catalog', () => ({ readLigaWorksheet, ligaMappingAvailable }))
vi.mock('next/navigation', () => ({ notFound }))

afterEach(() => {
  recordLigaCardAction.mockClear()
  readLigaWorksheet.mockReset()
  ligaMappingAvailable.mockReset()
  ligaMappingAvailable.mockReturnValue(true)
  notFound.mockClear()
})

/**
 * A conferência da Liga, coleção a coleção (decisão 071).
 *
 * O que se protege: cada arte mostra o que a tabela de correspondência pede, a
 * paralela não conferida aparece como tal, e o que a pessoa cola chega à ação
 * com a intenção certa.
 */

const ZORO_PAR = 'https://www.ligaonepiece.com.br/?view=cards/card&card=Roronoa+Zoro%20(OP01-001-PAR)&ed=OP-01&num=OP01-001-PAR'

const linha = (over: Partial<LigaWorksheetRow>): LigaWorksheetRow => ({
  sourceId: 'OP01-001',
  cardCode: 'OP01-001',
  cardName: 'Roronoa Zoro',
  variantType: 'Normal',
  rarity: 'L',
  imageUrl: null,
  setCodes: ['OP01'],
  inSet: true,
  verified: undefined,
  link: { exact: true, href: 'https://www.ligaonepiece.com.br/?view=cards/card&ed=OP-01&num=OP01-001' },
  liga: null,
  ...over,
})

const planilha: LigaWorksheet = {
  setCode: 'OP01',
  sets: [
    { code: 'OP01', name: '-ROMANCE DAWN-' },
    { code: 'OP02', name: 'Paramount War' },
  ],
  rows: [
    linha({}),
    linha({
      sourceId: 'OP01-001_p1',
      variantType: 'Parallel',
      verified: ZORO_PAR,
      link: { exact: true, href: ZORO_PAR },
      liga: { ed: 'OP-01', num: 'OP01-001-PAR', suffix: 'PAR' },
    }),
    linha({
      sourceId: 'OP01-013_p1',
      cardCode: 'OP01-013',
      cardName: 'Sanji',
      variantType: 'Parallel',
      rarity: 'R',
      link: { exact: false, href: 'https://www.ligaonepiece.com.br/?view=cards/search&card=OP01-013' },
    }),
    linha({
      sourceId: 'OP01-004_p1',
      cardCode: 'OP01-004',
      cardName: 'Usopp',
      variantType: 'Parallel',
      rarity: 'R',
      setCodes: ['PROMO'],
      inSet: false,
      link: { exact: false, href: 'https://www.ligaonepiece.com.br/?view=cards/search&card=OP01-004' },
    }),
  ],
  sample: [{ rarity: 'L', total: 8, conferidas: 1, divergentes: [] }],
}

const cartao = (sourceId: string) => screen.getByRole('form', { name: `Conferir ${sourceId}` })

describe('a planilha', () => {
  it('começa pelas paralelas impressas na coleção', () => {
    render(<LigaWorksheetView worksheet={planilha} />)

    expect(screen.getByRole('form', { name: 'Conferir OP01-001_p1' })).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Conferir OP01-013_p1' })).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Conferir OP01-001' })).not.toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Conferir OP01-004_p1' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /paralelas · faltam 1/i })).toBeInTheDocument()
  })

  it('mostra o código, o sufixo e a edição da Liga da arte conferida', () => {
    render(<LigaWorksheetView worksheet={planilha} />)
    const zoro = within(cartao('OP01-001_p1'))

    expect(zoro.getByText('Conferida')).toBeInTheDocument()
    expect(zoro.getByText('OP01-001-PAR')).toBeInTheDocument()
    expect(zoro.getByText('PAR')).toBeInTheDocument()
    expect(zoro.getByText('OP-01')).toBeInTheDocument()
    expect(zoro.getByLabelText('Endereço da carta na Liga')).toHaveValue(ZORO_PAR)
  })

  it('marca a paralela não conferida e dá a busca para achar a arte', () => {
    render(<LigaWorksheetView worksheet={planilha} />)
    const sanji = within(cartao('OP01-013_p1'))

    expect(sanji.getByText('Não conferida')).toBeInTheDocument()
    expect(sanji.getByText('busca')).toBeInTheDocument()
    expect(sanji.getByRole('link', { name: /procurar OP01-013 na Liga/i })).toHaveAttribute(
      'href',
      'https://www.ligaonepiece.com.br/?view=cards/search&card=OP01-013',
    )
    expect(sanji.queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument()
  })

  /* O caso do relato: a paralela da PROMO com codigo da OP01. */
  it('lista em "Outros produtos" a arte com o código da coleção impressa noutro lugar', async () => {
    const user = userEvent.setup()
    render(<LigaWorksheetView worksheet={planilha} />)

    await user.click(screen.getByRole('tab', { name: /outros produtos/i }))

    expect(within(cartao('OP01-004_p1')).getByText('PROMO')).toBeInTheDocument()
  })

  it('resume a amostra das normais', () => {
    render(<LigaWorksheetView worksheet={planilha} />)

    const tabela = screen.getByRole('table', { name: /normais conferidas por raridade/i })
    expect(within(tabela).getByText('Sem sufixo, como a regra')).toBeInTheDocument()
  })

  it('manda a arte, o endereço e a intenção para a ação', async () => {
    const user = userEvent.setup()
    render(<LigaWorksheetView worksheet={planilha} />)
    const sanji = within(cartao('OP01-013_p1'))

    await user.type(sanji.getByLabelText('Endereço da carta na Liga'), 'https://www.ligaonepiece.com.br/?x')
    await user.click(sanji.getByRole('button', { name: 'Gravar' }))

    const data = recordLigaCardAction.mock.calls[0][1]
    expect(data.get('arte')).toBe('OP01-013_p1')
    expect(data.get('url')).toBe('https://www.ligaonepiece.com.br/?x')
    expect(data.get('intencao')).toBe('gravar')
    expect(await sanji.findByText('Gravado.')).toBeInTheDocument()
  })

  it('"Não existe na Liga" vai com a própria intenção', async () => {
    const user = userEvent.setup()
    render(<LigaWorksheetView worksheet={planilha} />)

    await user.click(within(cartao('OP01-013_p1')).getByRole('button', { name: 'Não existe na Liga' }))

    expect(recordLigaCardAction.mock.calls[0][1].get('intencao')).toBe('sem-pagina')
  })

  it('mostra a recusa e mantém o que foi colado', async () => {
    recordLigaCardAction.mockResolvedValueOnce({ status: 'error', message: 'Não é um endereço.' } as never)
    const user = userEvent.setup()
    render(<LigaWorksheetView worksheet={planilha} />)
    const sanji = within(cartao('OP01-013_p1'))

    await user.type(sanji.getByLabelText('Endereço da carta na Liga'), 'https://colado')
    await user.click(sanji.getByRole('button', { name: 'Gravar' }))

    expect(await sanji.findByRole('alert')).toHaveTextContent('Não é um endereço.')
    expect(sanji.getByLabelText('Endereço da carta na Liga')).toHaveValue('https://colado')
  })
})

describe('a página', () => {
  it('não existe fora de desenvolvimento', async () => {
    ligaMappingAvailable.mockReturnValue(false)
    const { default: LigaPage } = await import('@/app/dev/liga/page')

    await expect(LigaPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(readLigaWorksheet).not.toHaveBeenCalled()
  })

  it('abre a OP01 quando nenhuma coleção foi pedida, e a pedida quando foi', async () => {
    readLigaWorksheet.mockResolvedValue(planilha)
    const { default: LigaPage } = await import('@/app/dev/liga/page')

    render(await LigaPage({ searchParams: Promise.resolve({}) }))
    expect(readLigaWorksheet).toHaveBeenLastCalledWith('OP01')
    expect(screen.getByRole('heading', { name: 'Conferência da Liga' })).toBeInTheDocument()

    await LigaPage({ searchParams: Promise.resolve({ set: 'OP02' }) })
    expect(readLigaWorksheet).toHaveBeenLastCalledWith('OP02')
  })
})
