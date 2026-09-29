import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LigaDuplicateReview } from '@/components/catalog/liga-duplicate-review'
import type { DuplicateReviewRow } from '@/server/application/catalog'

/* A acao grava o arquivo do repositorio: aqui ela e duble (armadilha 33). */
const { recordLigaCardAction } = vi.hoisted(() => ({
  recordLigaCardAction: vi.fn(async (_previous: unknown, _data: FormData) => ({ status: 'confirmed' as const })),
}))
vi.mock('@/app/dev/liga/actions', () => ({ recordLigaCardAction }))

afterEach(() => {
  recordLigaCardAction.mockClear()
})

/**
 * A revisão das artes que a Liga deixa iguais (decisão 073). O que se protege: as
 * artes do mesmo grupo aparecem juntas, o filtro por coleção, e o botão que
 * confirma manda a intenção certa.
 */

const linha = (sourceId: string, identidade: string, irmas: string[], over: Partial<DuplicateReviewRow> = {}): DuplicateReviewRow => ({
  sourceId,
  cardCode: sourceId.replace(/_p\d+$/, ''),
  cardName: 'Shanks',
  variantType: 'Parallel',
  rarity: 'SEC',
  imageUrl: null,
  setCodes: ['OP01'],
  inSet: true,
  verified: 'https://www.ligaonepiece.com.br/?view=cards/card&ed=OP-01&num=OP01-120-PAR',
  link: { exact: true, href: 'https://www.ligaonepiece.com.br/?view=cards/card&ed=OP-01&num=OP01-120-PAR' },
  liga: { ed: 'OP-01', num: 'OP01-120-PAR', suffix: 'PAR' },
  mesmoEnderecoQue: [],
  setCode: sourceId.split('-')[0],
  identidade,
  irmas,
  tcgProductId: null,
  ...over,
})

const rows = [
  linha('OP01-120_p1', 'parallel', ['OP01-120_p2']),
  linha('OP01-120_p2', 'parallel', ['OP01-120_p1']),
  linha('OP05-015_p4', 'full art', ['OP05-015_p5'], { cardName: 'Belo Betty' }),
  linha('OP05-015_p5', 'full art', ['OP05-015_p4'], { cardName: 'Belo Betty' }),
]

describe('a revisão das artes repetidas', () => {
  it('mostra cada grupo junto, dizendo o que a Liga repete', () => {
    render(<LigaDuplicateReview rows={rows} />)

    const shanks = screen.getByRole('region', { name: /OP01-120: 2 artes iguais na Liga/ })
    expect(within(shanks).getAllByRole('form')).toHaveLength(2)
    expect(within(shanks).getByRole('heading', { name: /o mesmo tratamento "parallel"/ })).toBeInTheDocument()
  })

  it('filtra por coleção', async () => {
    const user = userEvent.setup()
    render(<LigaDuplicateReview rows={rows} />)

    await user.click(screen.getByRole('tab', { name: /OP05\s*\(2\)/ }))

    expect(screen.queryByRole('region', { name: /OP01-120/ })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: /OP05-015/ })).toBeInTheDocument()
  })

  it('"a Liga não distingue estas artes" manda a própria intenção', async () => {
    const user = userEvent.setup()
    render(<LigaDuplicateReview rows={rows} />)

    const form = screen.getByRole('form', { name: 'Conferir OP01-120_p2' })
    await user.click(within(form).getByRole('button', { name: 'A Liga não distingue estas artes' }))

    const data = recordLigaCardAction.mock.calls[0][1]
    expect(data.get('arte')).toBe('OP01-120_p2')
    expect(data.get('intencao')).toBe('confirmar-mesma-identidade')
  })

  it('diz quando não sobra nada', () => {
    render(<LigaDuplicateReview rows={[]} />)
    expect(screen.getByText('Nada para revisar')).toBeInTheDocument()
  })
})
