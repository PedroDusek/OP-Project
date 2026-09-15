import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LigaConflictsReview } from '@/components/prices/liga-conflicts-review'
import type { LigaConflict } from '@/server/application/prices/liga-conflicts'

/* A acao grava o arquivo do repositorio: aqui e duble (armadilha 33). */
const { recordConflictAnswerAction } = vi.hoisted(() => ({
  recordConflictAnswerAction: vi.fn(async (_previous: unknown, _data: FormData) => ({
    status: 'saved' as const,
    produto: '653840',
  })),
}))
vi.mock('@/app/dev/liga/conflitos/actions', () => ({ recordConflictAnswerAction }))

afterEach(() => {
  recordConflictAnswerAction.mockClear()
})

/**
 * A revisão dos conflitos (decisão 074). O que se protege: os dois lados à vista,
 * o vínculo de hoje marcado entre os produtos, e a escolha chegando à ação.
 */

const produto = (productId: string, label: string, value: number | null) => ({ productId, label, groupCode: 'PRB-02', value })

const conflito: LigaConflict = {
  sourceId: 'OP09-020_p2',
  cardCode: 'OP09-020',
  cardName: 'Come On',
  rarity: 'SP CARD',
  imageUrl: null,
  sets: ['PRB-02'],
  liga: {
    url: 'https://www.ligaonepiece.com.br/?view=cards/card&ed=PRB2&num=OP09-020-MA',
    nome: 'Come On (Manga)',
    ed: 'PRB2',
    tratamento: 'manga',
  },
  vinculado: produto('653833', 'Alternate Art', 296.99),
  produtos: [produto('653833', 'Alternate Art', 296.99), produto('653840', 'Manga', 900)],
}

const outro: LigaConflict = { ...conflito, sourceId: 'OP07-109_p2', cardCode: 'OP07-109' }

describe('a revisão dos conflitos', () => {
  it('mostra o que a Liga diz e o vínculo de hoje, marcado entre os produtos', () => {
    render(<LigaConflictsReview conflitos={[conflito]} respostas={{}} />)
    const caso = within(screen.getByRole('form', { name: 'Conflito OP09-020_p2' }))

    expect(caso.getByText('manga')).toBeInTheDocument()
    expect(caso.getByRole('radio', { name: /alternate art.*vínculo de hoje/i })).toBeInTheDocument()
    expect(caso.getByRole('link', { name: 'produto 653833' })).toHaveAttribute(
      'href',
      'https://www.tcgplayer.com/product/653833',
    )
  })

  it('manda a arte e o produto escolhido para a ação', async () => {
    const user = userEvent.setup()
    render(<LigaConflictsReview conflitos={[conflito]} respostas={{}} />)
    const caso = within(screen.getByRole('form', { name: 'Conflito OP09-020_p2' }))

    expect(caso.getByRole('button', { name: 'Gravar no arquivo manual' })).toBeDisabled()
    await user.click(caso.getByRole('radio', { name: /manga/i }))
    await user.click(caso.getByRole('button', { name: 'Gravar no arquivo manual' }))

    const data = recordConflictAnswerAction.mock.calls[0][1]
    expect(data.get('arte')).toBe('OP09-020_p2')
    expect(data.get('produto')).toBe('653840')
  })

  it('esconde o respondido em "Faltam", e o mostra marcado em "Todos"', async () => {
    const user = userEvent.setup()
    render(<LigaConflictsReview conflitos={[conflito, outro]} respostas={{ 'OP09-020_p2': '653840' }} />)

    expect(screen.queryByRole('form', { name: 'Conflito OP09-020_p2' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /todos/i }))

    const caso = within(screen.getByRole('form', { name: 'Conflito OP09-020_p2' }))
    expect(caso.getByText('Respondido')).toBeInTheDocument()
    expect(caso.getByRole('radio', { name: /manga/i })).toBeChecked()
  })
})
