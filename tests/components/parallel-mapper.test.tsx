import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ParallelMapper } from '@/components/prices/parallel-mapper'
import type { ParallelCandidate } from '@/server/domain/prices/parallel-candidates'

/*
 * A acao grava um arquivo do repositorio, e a pagina le do disco. Nos dois, o
 * duble e o que impede um teste de componente de mexer em
 * `data/vinculos-manuais.json` (armadilha 33, com um motivo a mais).
 */
const { recordCardMappingAction, readMapping, mappingAvailable, notFound } = vi.hoisted(() => ({
  recordCardMappingAction: vi.fn(async (_previous: unknown, _data: FormData) => ({
    status: 'saved' as const,
    recorded: 1,
  })),
  readMapping: vi.fn(),
  mappingAvailable: vi.fn(() => true),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

vi.mock('@/app/dev/paralelas/actions', () => ({ recordCardMappingAction }))
vi.mock('@/server/application/prices/parallel-mapping', () => ({ readMapping, mappingAvailable }))
vi.mock('next/navigation', () => ({ notFound }))

afterEach(() => {
  recordCardMappingAction.mockClear()
  readMapping.mockReset()
  mappingAvailable.mockReset()
  mappingAvailable.mockReturnValue(true)
  notFound.mockClear()
})

/**
 * A tela de mapeamento das paralelas (decisão 068).
 *
 * O que se protege: a pessoa ve as duas artes lado a lado, nao consegue dar o
 * mesmo produto a duas artes sem perceber, e o que ela escolhe chega a acao no
 * formato que o caso de uso confere.
 */

const arte = (sourceId: string, rarity: string, imageUrl: string | null, extra: Partial<ParallelCandidate['ours'][number]> = {}) => ({
  sourceId,
  variantType: 'Parallel' as const,
  rarity,
  imageUrl,
  motivo: 'sem-vinculo' as const,
  atual: null,
  liga: null,
  sugestao: null,
  ...extra,
})

const produto = (productId: string, label: string, value: number | null, extra: Partial<ParallelCandidate['theirs'][number]> = {}) => ({
  productId,
  label,
  value,
  groupCode: null,
  dono: null,
  ...extra,
})

const nami: ParallelCandidate = {
  cardCode: 'OP01-016',
  cardName: 'Nami',
  setCode: 'OP01',
  ours: [
    arte('OP01-016_p1', 'R', 'https://en.onepiece-cardgame.com/images/cardlist/card/OP01-016_p1.png'),
    arte('OP01-016_p2', 'SR', null),
  ],
  theirs: [produto('100', 'Alternate Art', 12.5), produto('101', 'Manga', null)],
}

const zoro: ParallelCandidate = {
  cardCode: 'OP01-001',
  cardName: 'Roronoa Zoro',
  setCode: 'OP01',
  ours: [arte('OP01-001_p1', 'L', null)],
  theirs: [produto('200', 'Parallel', 614.28)],
}

const linha = (sourceId: string) => screen.getByRole('group', { name: `Qual produto é a arte ${sourceId}` })

describe('o pareamento de uma carta', () => {
  it('mostra cada arte nossa com os produtos da fonte, tratamento e preço', () => {
    render(<ParallelMapper cartas={[nami]} manual={{}} />)

    const p1 = within(linha('OP01-016_p1'))
    expect(p1.getByRole('img', { name: 'Arte OP01-016_p1' })).toBeInTheDocument()
    // O jsdom nao poe espaco entre blocos no nome acessivel; o navegador poe.
    expect(p1.getByRole('radio', { name: /alternate art\s*\$12\.50/i })).toBeInTheDocument()
    expect(p1.getByRole('radio', { name: /manga\s*sem preço/i })).toBeInTheDocument()
    expect(p1.getByRole('radio', { name: /não tem na fonte/i })).toBeInTheDocument()
    expect(p1.getByRole('radio', { name: /deixar para depois/i })).toBeChecked()
  })

  /* O CDN do TCGplayer nao passa pelo otimizador: a miniatura e o endereco direto. */
  it('usa a miniatura da fonte', () => {
    const { container } = render(<ParallelMapper cartas={[nami]} manual={{}} />)

    const miniaturas = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'))
    expect(miniaturas).toContain('https://tcgplayer-cdn.tcgplayer.com/product/100_200w.jpg')
  })

  it('desabilita nas outras linhas o produto que uma arte já escolheu', async () => {
    const user = userEvent.setup()
    render(<ParallelMapper cartas={[nami]} manual={{}} />)

    await user.click(within(linha('OP01-016_p1')).getByRole('radio', { name: /alternate art/i }))

    expect(within(linha('OP01-016_p2')).getByRole('radio', { name: /alternate art/i })).toBeDisabled()
    expect(within(linha('OP01-016_p2')).getByRole('radio', { name: /manga/i })).toBeEnabled()
    // "Nao tem" nao e produto: duas artes podem nao existir na fonte.
    await user.click(within(linha('OP01-016_p1')).getByRole('radio', { name: /não tem na fonte/i }))
    await user.click(within(linha('OP01-016_p2')).getByRole('radio', { name: /não tem na fonte/i }))
    expect(within(linha('OP01-016_p1')).getByRole('radio', { name: /não tem na fonte/i })).toBeChecked()
  })

  it('não deixa gravar sem escolha nenhuma', () => {
    render(<ParallelMapper cartas={[nami]} manual={{}} />)

    expect(screen.getByRole('button', { name: /gravar 0 respostas/i })).toBeDisabled()
  })

  it('manda a carta e a escolha de cada arte para a ação', async () => {
    const user = userEvent.setup()
    render(<ParallelMapper cartas={[nami]} manual={{}} />)

    await user.click(within(linha('OP01-016_p1')).getByRole('radio', { name: /manga/i }))
    await user.click(within(linha('OP01-016_p2')).getByRole('radio', { name: /não tem na fonte/i }))
    await user.click(screen.getByRole('button', { name: /gravar 2 respostas/i }))

    expect(recordCardMappingAction).toHaveBeenCalledTimes(1)
    const data = recordCardMappingAction.mock.calls[0][1]
    expect(data.get('carta')).toBe('OP01-016')
    expect(data.get('arte:OP01-016_p1')).toBe('101')
    expect(data.get('arte:OP01-016_p2')).toBe('nenhum')
    expect(await screen.findByText(/gravado no arquivo manual: 1 resposta/i)).toBeInTheDocument()
  })

  it('mostra a recusa da ação', async () => {
    recordCardMappingAction.mockResolvedValueOnce({
      status: 'error',
      message: 'O produto 100 não é uma arte de OP01-016 na fonte.',
    } as never)
    const user = userEvent.setup()
    render(<ParallelMapper cartas={[nami]} manual={{}} />)

    await user.click(within(linha('OP01-016_p1')).getByRole('radio', { name: /alternate art/i }))
    await user.click(screen.getByRole('button', { name: /gravar 1 resposta/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('O produto 100 não é uma arte de OP01-016 na fonte.')
  })
})

describe('o que já foi respondido', () => {
  /* Sem isto, gravar de novo apagaria a resposta anterior sem a pessoa ve-la. */
  it('volta preenchido com a resposta gravada', async () => {
    const user = userEvent.setup()
    render(<ParallelMapper cartas={[nami]} manual={{ 'OP01-016_p1': { produto: '101' } }} />)

    expect(within(linha('OP01-016_p1')).getByRole('radio', { name: /manga/i })).toBeChecked()
    expect(within(linha('OP01-016_p2')).getByRole('radio', { name: /manga/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /gravar 1 resposta/i })).toBeEnabled()
    // Parcial ainda falta: continua no filtro padrao, sem o selo de respondida.
    expect(screen.getByRole('form', { name: 'Mapear OP01-016' })).toBeInTheDocument()
    expect(screen.queryByText('Respondida')).not.toBeInTheDocument()

    // E o que estava escolhido pode virar "depois" de novo.
    await user.click(within(linha('OP01-016_p1')).getByRole('radio', { name: /deixar para depois/i }))
    expect(screen.getByRole('button', { name: /gravar 0 respostas/i })).toBeDisabled()
  })

  it('esconde a carta respondida por inteiro, e a mostra em "Todas"', async () => {
    const user = userEvent.setup()
    render(
      <ParallelMapper
        cartas={[nami, zoro]}
        manual={{ 'OP01-016_p1': { produto: '100' }, 'OP01-016_p2': { produto: null } }}
      />,
    )

    expect(screen.queryByRole('form', { name: 'Mapear OP01-016' })).not.toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Mapear OP01-001' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /todas/i }))

    const formNami = screen.getByRole('form', { name: 'Mapear OP01-016' })
    expect(within(formNami).getByText('Respondida')).toBeInTheDocument()
    expect(within(formNami).getAllByRole('radio', { name: /não tem na fonte/i })[1]).toBeChecked()
  })

  it('diz quando não falta nenhuma', () => {
    render(<ParallelMapper cartas={[zoro]} manual={{ 'OP01-001_p1': { produto: '200' } }} />)

    expect(screen.getByText('Nenhuma carta falta')).toBeInTheDocument()
  })
})

describe('o que a linha diz (decisão 077)', () => {
  /* A OP01-052: a p1 estava no Jolly Roger Foil, e a pagina da Liga dela e o Event Pack. */
  const raizo: ParallelCandidate = {
    cardCode: 'OP01-052',
    cardName: 'Raizo',
    setCode: 'OP01',
    ours: [
      arte('OP01-052_p1', 'UC', null, {
        motivo: 'liga-sugere-outro',
        atual: { productId: 'jr', origin: 'manual' },
        liga: { url: 'https://www.ligaonepiece.com.br/?view=cards/card&ed=PC-01&num=OP01-052-EP', tratamento: 'event pack vol 2' },
        sugestao: 'ep',
      }),
      arte('OP01-052_p3', 'UC', null),
    ],
    theirs: [
      produto('jr', 'Jolly Roger Foil', 0.17, { groupCode: 'PRB-01', dono: 'OP01-052_p1' }),
      produto('ep', 'Event Pack Vol. 2', 0.34, { groupCode: 'OP-PR' }),
    ],
  }

  it('mostra o vínculo de hoje, a Liga, o que ela aponta e o dono de cada produto', () => {
    render(<ParallelMapper cartas={[raizo]} manual={{ 'OP01-052_p1': { produto: 'jr' } }} />)
    const p1 = within(linha('OP01-052_p1'))
    const p3 = within(linha('OP01-052_p3'))

    expect(p1.getByText('A Liga aponta outro produto')).toBeInTheDocument()
    expect(p1.getByText('Jolly Roger Foil · PRB-01 (manual)')).toBeInTheDocument()
    expect(p1.getByRole('link', { name: 'página conferida' })).toHaveAttribute('href', raizo.ours[0].liga!.url)
    expect(p1.getByRole('radio', { name: /event pack vol\. 2.*a liga aponta/i })).toBeInTheDocument()
    expect(p3.getByRole('radio', { name: /jolly roger foil.*de OP01-052_p1/i })).toBeInTheDocument()
    expect(p3.getByRole('link', { name: 'produto ep no TCGplayer' })).toHaveAttribute(
      'href',
      'https://www.tcgplayer.com/product/ep',
    )
  })

  it('a resposta que aceita a sugestão tira a carta de "Faltam"', () => {
    render(<ParallelMapper cartas={[raizo]} manual={{ 'OP01-052_p1': { produto: 'ep' }, 'OP01-052_p3': { produto: 'jr' } }} />)
    expect(screen.getByText('Nenhuma carta falta')).toBeInTheDocument()
  })
})

describe('a página', () => {
  it('não existe fora de desenvolvimento', async () => {
    mappingAvailable.mockReturnValue(false)
    const { default: ParalelasPage } = await import('@/app/dev/paralelas/page')

    expect(() => ParalelasPage()).toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
    expect(readMapping).not.toHaveBeenCalled()
  })

  it('diz como gerar o levantamento quando ele falta', async () => {
    readMapping.mockReturnValue({ candidates: null, answered: 0, manual: {} })
    const { default: ParalelasPage } = await import('@/app/dev/paralelas/page')

    render(ParalelasPage())

    expect(screen.getByText('O levantamento ainda não foi gerado')).toBeInTheDocument()
    expect(screen.getByText(/npm run paralelas:candidatos/)).toBeInTheDocument()
  })

  it('mostra o levantamento e o progresso do arquivo manual', async () => {
    readMapping.mockReturnValue({
      candidates: { geradoEm: '2026-09-13T21:25:10.939Z', cartas: [nami, zoro] },
      answered: 3,
      manual: {},
    })
    const { default: ParalelasPage } = await import('@/app/dev/paralelas/page')

    render(ParalelasPage())

    expect(screen.getByRole('heading', { name: 'Mapeamento das paralelas' })).toBeInTheDocument()
    expect(screen.getByText(/13\/09\/2026.*2 cartas.*3 respostas no arquivo manual/)).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Mapear OP01-016' })).toBeInTheDocument()
  })
})
