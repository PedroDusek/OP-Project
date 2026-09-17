import { beforeEach, describe, expect, it, vi } from 'vitest'
import { blockMemberAction, reportMemberAction, unblockMemberAction } from '@/app/(app)/social/actions'
import { NETWORK_ACTION_IDLE } from '@/app/(app)/social/state'
import { ValidationError } from '@/server/domain/errors'

/*
 * O caso de uso grava no banco: aqui e duble. A regra esta em
 * `tests/integration/social-network.test.ts`.
 */
const { blockMember, unblockMember, reportMember, currentViewer, revalidatePath } = vi.hoisted(() => ({
  blockMember: vi.fn(),
  unblockMember: vi.fn(),
  reportMember: vi.fn(),
  currentViewer: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock('@/server/application/social', () => ({ blockMember, unblockMember, reportMember }))
vi.mock('@/server/http/viewer', () => ({ currentViewer }))
vi.mock('next/cache', () => ({ revalidatePath }))

const eu = { id: 1n, email: 'eu@example.test', name: 'Eu', plan: 'FREE', premiumUntil: null }

const form = (campos: Record<string, string>) => {
  const data = new FormData()
  for (const [nome, valor] of Object.entries(campos)) data.append(nome, valor)
  return data
}

beforeEach(() => {
  vi.clearAllMocks()
  currentViewer.mockResolvedValue(eu)
})

describe('as ações da rede', () => {
  /* Quem age e a sessao; o formulario so diz o alvo. */
  it('bloqueia pelo nome, com quem está na sessão', async () => {
    const r = await blockMemberAction(NETWORK_ACTION_IDLE, form({ username: ' ana ' }))
    expect(blockMember).toHaveBeenCalledWith(eu, 'ana')
    expect(revalidatePath).toHaveBeenCalledWith('/social/ana')
    expect(r).toEqual({ status: 'done', message: '@ana foi bloqueado.' })
  })

  it('desbloqueia', async () => {
    await unblockMemberAction(NETWORK_ACTION_IDLE, form({ username: 'ana' }))
    expect(unblockMember).toHaveBeenCalledWith(eu, 'ana')
  })

  it('denuncia com o motivo, e mostra a recusa do caso de uso', async () => {
    reportMember.mockRejectedValueOnce(new ValidationError('Conte o que aconteceu: a denúncia precisa de um motivo.'))
    const r = await reportMemberAction(NETWORK_ACTION_IDLE, form({ username: 'ana', motivo: '' }))
    expect(reportMember).toHaveBeenCalledWith(eu, 'ana', '')
    expect(r).toEqual({ status: 'error', message: 'Conte o que aconteceu: a denúncia precisa de um motivo.' })
  })

  it('sem sessão, não chama nada', async () => {
    currentViewer.mockResolvedValue(null)
    const r = await blockMemberAction(NETWORK_ACTION_IDLE, form({ username: 'ana' }))
    expect(blockMember).not.toHaveBeenCalled()
    expect(r.status).toBe('error')
  })
})
