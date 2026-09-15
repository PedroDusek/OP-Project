import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recordLigaCardAction } from '@/app/dev/liga/actions'
import { LIGA_CARD_IDLE } from '@/app/dev/liga/state'
import { NotFoundError, ValidationError } from '@/server/domain/errors'

/*
 * Os casos de uso gravam `data/liga-cartas.json` do repositorio. Aqui eles sao
 * dubles: o que se testa e a traducao do formulario, e a regra esta testada em
 * `tests/integration/liga-mapping.test.ts`, contra arquivo temporario.
 */
const { recordLigaCard, clearLigaCard, confirmReprint, revalidatePath } = vi.hoisted(() => ({
  recordLigaCard: vi.fn(),
  clearLigaCard: vi.fn(),
  confirmReprint: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/server/application/catalog', () => ({ recordLigaCard, clearLigaCard, confirmReprint }))
vi.mock('next/cache', () => ({ revalidatePath }))

const URL_ZORO = 'https://www.ligaonepiece.com.br/?view=cards/card&ed=OP-01&num=OP01-001-PAR'

const form = (campos: Record<string, string>) => {
  const data = new FormData()
  for (const [nome, valor] of Object.entries(campos)) data.append(nome, valor)
  return data
}

beforeEach(() => {
  recordLigaCard.mockReset()
  clearLigaCard.mockReset()
  confirmReprint.mockReset()
  revalidatePath.mockReset()
})

describe('recordLigaCardAction', () => {
  it('grava o endereço colado', async () => {
    recordLigaCard.mockResolvedValue({ arte: 'OP01-001_p1', url: URL_ZORO })

    const r = await recordLigaCardAction(LIGA_CARD_IDLE, form({ arte: 'OP01-001_p1', url: URL_ZORO, intencao: 'gravar' }))

    expect(recordLigaCard).toHaveBeenCalledWith('OP01-001_p1', URL_ZORO)
    expect(revalidatePath).toHaveBeenCalledWith('/dev/liga')
    expect(r).toEqual({ status: 'saved', url: URL_ZORO })
  })

  /* "Nao existe na Liga" ignora o campo: e uma resposta, e nao um endereco vazio. */
  it('grava "não existe na Liga" como null, mesmo com texto no campo', async () => {
    recordLigaCard.mockResolvedValue({ arte: 'OP01-004_p1', url: null })

    const r = await recordLigaCardAction(
      LIGA_CARD_IDLE,
      form({ arte: 'OP01-004_p1', url: 'sobrou', intencao: 'sem-pagina' }),
    )

    expect(recordLigaCard).toHaveBeenCalledWith('OP01-004_p1', null)
    expect(r).toEqual({ status: 'saved', url: null })
  })

  it('desfaz a conferência', async () => {
    const r = await recordLigaCardAction(LIGA_CARD_IDLE, form({ arte: 'OP01-001_p1', intencao: 'limpar' }))

    expect(clearLigaCard).toHaveBeenCalledWith('OP01-001_p1')
    expect(recordLigaCard).not.toHaveBeenCalled()
    expect(r).toEqual({ status: 'cleared' })
  })

  /* As duas telas leem a mesma tabela: gravar numa desatualiza a outra. */
  it('confirma a reimpressão e atualiza as duas telas', async () => {
    const r = await recordLigaCardAction(
      LIGA_CARD_IDLE,
      form({ arte: 'EB01-018_p1', url: 'sobrou', intencao: 'confirmar-reprint' }),
    )

    expect(confirmReprint).toHaveBeenCalledWith('EB01-018_p1')
    expect(recordLigaCard).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith('/dev/liga')
    expect(revalidatePath).toHaveBeenCalledWith('/dev/liga/revisar')
    expect(r).toEqual({ status: 'confirmed' })
  })

  it('pede o endereço em vez de gravar vazio', async () => {
    const r = await recordLigaCardAction(LIGA_CARD_IDLE, form({ arte: 'OP01-001_p1', url: '  ', intencao: 'gravar' }))

    expect(r).toEqual({ status: 'error', message: 'Cole o endereço da carta na Liga.' })
    expect(recordLigaCard).not.toHaveBeenCalled()
  })

  it('recusa sem arte', async () => {
    const r = await recordLigaCardAction(LIGA_CARD_IDLE, form({ url: URL_ZORO }))
    expect(r).toEqual({ status: 'error', message: 'Arte não informada.' })
  })

  it('mostra a recusa do caso de uso', async () => {
    recordLigaCard.mockRejectedValueOnce(new ValidationError('O endereço não é da Liga (www.ligaonepiece.com.br).'))
    const invalido = await recordLigaCardAction(LIGA_CARD_IDLE, form({ arte: 'OP01-001_p1', url: 'https://x.com' }))
    expect(invalido).toEqual({ status: 'error', message: 'O endereço não é da Liga (www.ligaonepiece.com.br).' })

    clearLigaCard.mockImplementationOnce(() => {
      throw new NotFoundError('A conferência da Liga só existe fora de produção.')
    })
    const producao = await recordLigaCardAction(LIGA_CARD_IDLE, form({ arte: 'OP01-001_p1', intencao: 'limpar' }))
    expect(producao).toEqual({ status: 'error', message: 'A conferência da Liga só existe fora de produção.' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('deixa passar o erro inesperado', async () => {
    recordLigaCard.mockRejectedValueOnce(new Error('EACCES'))
    await expect(
      recordLigaCardAction(LIGA_CARD_IDLE, form({ arte: 'OP01-001_p1', url: URL_ZORO })),
    ).rejects.toThrow('EACCES')
  })
})
