import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LigaReprintReview } from '@/components/catalog/liga-reprint-review'
import type { ReprintReviewRow } from '@/server/application/catalog'

/*
 * A acao grava o `data/liga-cartas.json` do repositorio: aqui ela e duble, e o
 * Prisma nao entra no grafo (armadilha 33).
 */
const { recordLigaCardAction } = vi.hoisted(() => ({
  recordLigaCardAction: vi.fn(async (_previous: unknown, _data: FormData) => ({ status: 'confirmed' as const })),
}))
vi.mock('@/app/dev/liga/actions', () => ({ recordLigaCardAction }))

afterEach(() => {
  recordLigaCardAction.mockClear()
})

/**
 * A revisão das paralelas conferidas como reimpressão que provavelmente são
 * outra versão. O que se protege: o filtro por coleção, o porquê da suspeita na
 * linha, e o botão de confirmar mandando a intenção certa.
 */

const linha = (sourceId: string, setCode: string, over: Partial<ReprintReviewRow> = {}): ReprintReviewRow => ({
  sourceId,
  cardCode: sourceId.replace(/_p\d+$/, ''),
  cardName: 'Carta',
  variantType: 'Parallel',
  rarity: 'C',
  imageUrl: null,
  setCodes: ['PRB-02'],
  inSet: true,
  verified: 'https://www.ligaonepiece.com.br/?view=cards/card&card=X+%28Reprint%29&ed=PRB2&num=X-RE',
  link: { exact: true, href: 'https://www.ligaonepiece.com.br/?view=cards/card&ed=PRB2&num=X-RE' },
  liga: { ed: 'PRB2', num: `${sourceId.replace(/_p\d+$/, '')}-RE`, suffix: 'RE' },
  setCode,
  normalSets: ['EB-01', 'PRB-02'],
  tcgProductId: '655984',
  ...over,
})

const rows = [
  linha('EB01-018_p1', 'EB01'),
  linha('EB01-060_p1', 'EB01'),
  linha('OP09-033_p1', 'OP09', { normalSets: ['OP09', 'PRB-02'], tcgProductId: null }),
]

const cartao = (sourceId: string) => screen.getByRole('form', { name: `Conferir ${sourceId}` })

describe('a revisão das reimpressões', () => {
  it('separa por coleção, com quantas faltam em cada uma', async () => {
    const user = userEvent.setup()
    render(<LigaReprintReview rows={rows} />)

    expect(screen.getByRole('tab', { name: /todas\s*\(3\)/i })).toBeInTheDocument()
    expect(screen.getAllByRole('form')).toHaveLength(3)

    await user.click(screen.getByRole('tab', { name: /EB01\s*\(2\)/ }))

    expect(screen.getAllByRole('form')).toHaveLength(2)
    expect(screen.queryByRole('form', { name: 'Conferir OP09-033_p1' })).not.toBeInTheDocument()
  })

  it('diz por que a reimpressão é suspeita e leva ao produto que dá o preço', () => {
    render(<LigaReprintReview rows={rows} />)
    const eb = within(cartao('EB01-018_p1'))

    expect(eb.getByText(/a normal de EB01-018 já saiu em EB-01, PRB-02/)).toBeInTheDocument()
    expect(eb.getByRole('link', { name: /produto que dá o preço hoje/i })).toHaveAttribute(
      'href',
      'https://www.tcgplayer.com/product/655984',
    )
    // Sem vinculo, nao ha produto para mostrar.
    expect(
      within(cartao('OP09-033_p1')).queryByRole('link', { name: /produto que dá o preço hoje/i }),
    ).not.toBeInTheDocument()
  })

  it('"a reimpressão está certa" manda a própria intenção', async () => {
    const user = userEvent.setup()
    render(<LigaReprintReview rows={rows} />)

    await user.click(within(cartao('EB01-018_p1')).getByRole('button', { name: 'A reimpressão está certa' }))

    const data = recordLigaCardAction.mock.calls[0][1]
    expect(data.get('arte')).toBe('EB01-018_p1')
    expect(data.get('intencao')).toBe('confirmar-reprint')
    expect(await screen.findByText(/confirmada: a arte sai da revisão/i)).toBeInTheDocument()
  })

  it('diz quando não sobra nada', () => {
    render(<LigaReprintReview rows={[]} />)
    expect(screen.getByText('Nada para revisar')).toBeInTheDocument()
  })
})
