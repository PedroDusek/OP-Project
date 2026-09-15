import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recordConflictAnswerAction } from '@/app/dev/liga/conflitos/actions'
import { CONFLICT_ANSWER_IDLE } from '@/app/dev/liga/conflitos/state'
import { ValidationError } from '@/server/domain/errors'

/*
 * O caso de uso grava o arquivo do repositorio: aqui ele e duble. A regra esta em
 * `liga-conflicts.test.ts`, contra arquivos temporarios.
 */
const { recordConflictAnswer, revalidatePath } = vi.hoisted(() => ({
  recordConflictAnswer: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock('@/server/application/prices/liga-conflicts', () => ({ recordConflictAnswer }))
vi.mock('next/cache', () => ({ revalidatePath }))

const form = (campos: Record<string, string>) => {
  const data = new FormData()
  for (const [nome, valor] of Object.entries(campos)) data.append(nome, valor)
  return data
}

beforeEach(() => {
  recordConflictAnswer.mockReset()
  revalidatePath.mockReset()
})

describe('recordConflictAnswerAction', () => {
  it('grava o produto escolhido', async () => {
    recordConflictAnswer.mockReturnValue({ variante: 'OP09-020_p2', produto: '653840' })
    const r = await recordConflictAnswerAction(CONFLICT_ANSWER_IDLE, form({ arte: 'OP09-020_p2', produto: '653840' }))

    expect(recordConflictAnswer).toHaveBeenCalledWith('OP09-020_p2', '653840')
    expect(revalidatePath).toHaveBeenCalledWith('/dev/liga/conflitos')
    expect(r).toEqual({ status: 'saved', produto: '653840' })
  })

  it('"nenhum destes" vai como nulo', async () => {
    recordConflictAnswer.mockReturnValue({ variante: 'OP09-020_p2', produto: null })
    await recordConflictAnswerAction(CONFLICT_ANSWER_IDLE, form({ arte: 'OP09-020_p2', produto: 'nenhum' }))
    expect(recordConflictAnswer).toHaveBeenCalledWith('OP09-020_p2', null)
  })

  it('pede uma escolha em vez de gravar vazio', async () => {
    const r = await recordConflictAnswerAction(CONFLICT_ANSWER_IDLE, form({ arte: 'OP09-020_p2' }))
    expect(r).toEqual({ status: 'error', message: 'Escolha o produto certo, ou "nenhum destes".' })
    expect(recordConflictAnswer).not.toHaveBeenCalled()
  })

  it('mostra a recusa do caso de uso', async () => {
    recordConflictAnswer.mockImplementation(() => {
      throw new ValidationError('O produto 999 não é de OP09-020 no TCGplayer.')
    })
    const r = await recordConflictAnswerAction(CONFLICT_ANSWER_IDLE, form({ arte: 'OP09-020_p2', produto: '999' }))
    expect(r).toEqual({ status: 'error', message: 'O produto 999 não é de OP09-020 no TCGplayer.' })
  })
})
