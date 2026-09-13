import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recordCardMappingAction } from '@/app/dev/paralelas/actions'
import { MAPPING_IDLE } from '@/app/dev/paralelas/state'
import { NotFoundError, ValidationError } from '@/server/domain/errors'

/*
 * O caso de uso grava `data/vinculos-manuais.json` do repositorio. Aqui ele e
 * duble: o que se testa e a traducao do formulario, e a regra ja e testada em
 * `parallel-mapping.test.ts`, contra arquivos temporarios.
 */
const { recordCardMapping, revalidatePath } = vi.hoisted(() => ({
  recordCardMapping: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/server/application/prices/parallel-mapping', () => ({ recordCardMapping }))
vi.mock('next/cache', () => ({ revalidatePath }))

const form = (campos: [string, string][]) => {
  const data = new FormData()
  for (const [nome, valor] of campos) data.append(nome, valor)
  return data
}

beforeEach(() => {
  recordCardMapping.mockReset()
  revalidatePath.mockReset()
})

describe('recordCardMappingAction', () => {
  it('traduz produto, "nao tem" e "depois" em respostas', async () => {
    recordCardMapping.mockReturnValue({ recorded: 2 })

    const r = await recordCardMappingAction(
      MAPPING_IDLE,
      form([
        ['carta', 'OP01-016'],
        ['arte:OP01-016_p1', '100'],
        ['arte:OP01-016_p2', 'nenhum'],
        // "Deixar para depois" chega vazio, e nao e resposta.
        ['arte:OP01-016_p3', ''],
        ['outro', 'ignorado'],
      ]),
    )

    expect(recordCardMapping).toHaveBeenCalledWith('OP01-016', [
      { sourceId: 'OP01-016_p1', productId: '100' },
      { sourceId: 'OP01-016_p2', productId: null },
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/dev/paralelas')
    expect(r).toEqual({ status: 'saved', recorded: 2 })
  })

  it('recusa sem carta, antes de chamar o caso de uso', async () => {
    const r = await recordCardMappingAction(MAPPING_IDLE, form([['arte:OP01-016_p1', '100']]))

    expect(r).toEqual({ status: 'error', message: 'Carta não informada.' })
    expect(recordCardMapping).not.toHaveBeenCalled()
  })

  /* A mensagem do caso de uso diz o que nao fechou; "erro interno" nao diria. */
  it('mostra a mensagem da recusa do caso de uso', async () => {
    recordCardMapping.mockImplementation(() => {
      throw new ValidationError('Vínculos manuais inconsistentes: o produto 100 foi dado a A e B.')
    })

    const r = await recordCardMappingAction(MAPPING_IDLE, form([['carta', 'OP01-016']]))

    expect(r).toEqual({
      status: 'error',
      message: 'Vínculos manuais inconsistentes: o produto 100 foi dado a A e B.',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('responde a recusa de producao como erro, sem gravar', async () => {
    recordCardMapping.mockImplementation(() => {
      throw new NotFoundError('O mapeamento de paralelas só existe fora de produção.')
    })

    const r = await recordCardMappingAction(MAPPING_IDLE, form([['carta', 'OP01-016']]))

    expect(r).toEqual({ status: 'error', message: 'O mapeamento de paralelas só existe fora de produção.' })
  })

  it('deixa passar o erro inesperado', async () => {
    recordCardMapping.mockImplementation(() => {
      throw new Error('EACCES')
    })

    await expect(recordCardMappingAction(MAPPING_IDLE, form([['carta', 'OP01-016']]))).rejects.toThrow('EACCES')
  })
})
