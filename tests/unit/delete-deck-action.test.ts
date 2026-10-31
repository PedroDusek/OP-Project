import { beforeEach, describe, expect, it, vi } from 'vitest'
import { excluirDeckAction } from '@/app/(app)/deck/actions'
import { DECK_DELETE_IDLE } from '@/app/(app)/deck/state'
import { NotFoundError } from '@/server/domain/errors'

/*
 * A ação é fina: lê a sessão, chama **um** caso de uso e traduz o resultado.
 * O caso de uso é duble aqui — a regra dele, inclusive a de só apagar lista da
 * própria pessoa, está em `tests/integration/saved-decks.test.ts`, contra banco.
 *
 * `redirect` do Next lança para interromper a ação. O duble lança igual, senão
 * o teste passaria mesmo que o `redirect` estivesse depois de um `return`.
 */
const { deleteDeck, currentViewer, revalidatePath, redirect } = vi.hoisted(() => ({
  deleteDeck: vi.fn(),
  currentViewer: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((destino: string) => {
    throw new Error(`NEXT_REDIRECT:${destino}`)
  }),
}))

vi.mock('@/server/application/decks', () => ({
  deleteDeck,
  analyzeDeck: vi.fn(),
  saveDeck: vi.fn(),
  planDeckTransfer: vi.fn(),
  executeDeckTransfer: vi.fn(),
}))
vi.mock('@/server/application/wants', () => ({ bulkAddWants: vi.fn() }))
vi.mock('@/server/http/viewer', () => ({ currentViewer }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/navigation', () => ({ redirect }))

const eu = { id: 7n, email: 'eu@exemplo.com' }

const form = (campos: Record<string, string>) => {
  const data = new FormData()
  for (const [nome, valor] of Object.entries(campos)) data.append(nome, valor)
  return data
}

beforeEach(() => {
  deleteDeck.mockReset()
  currentViewer.mockReset()
  revalidatePath.mockReset()
  redirect.mockClear()
  currentViewer.mockResolvedValue(eu)
})

describe('excluirDeckAction', () => {
  it('apaga a lista, revalida /deck e volta para lá', async () => {
    deleteDeck.mockResolvedValue(undefined)

    await expect(excluirDeckAction(DECK_DELETE_IDLE, form({ id: '42' }))).rejects.toThrow(
      'NEXT_REDIRECT:/deck',
    )

    expect(deleteDeck).toHaveBeenCalledWith(eu, '42')
    expect(revalidatePath).toHaveBeenCalledWith('/deck')
  })

  it('sem sessão não chama o caso de uso', async () => {
    currentViewer.mockResolvedValue(null)

    const r = await excluirDeckAction(DECK_DELETE_IDLE, form({ id: '42' }))

    expect(r.status).toBe('error')
    expect(deleteDeck).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('id que não é número nem chega ao caso de uso', async () => {
    const r = await excluirDeckAction(DECK_DELETE_IDLE, form({ id: '7; drop' }))

    expect(r.status).toBe('error')
    expect(deleteDeck).not.toHaveBeenCalled()
  })

  it('lista de outra pessoa vira erro na tela, e não redireciona', async () => {
    deleteDeck.mockRejectedValue(new NotFoundError('Lista não encontrada.'))

    const r = await excluirDeckAction(DECK_DELETE_IDLE, form({ id: '42' }))

    expect(r.status).toBe('error')
    expect(redirect).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
