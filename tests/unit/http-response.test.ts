import { describe, expect, it, vi } from 'vitest'
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '@/server/domain/errors'
import { errorResponse, jsonResponse } from '@/server/http/response'

/** Testes puros: nenhuma rede, nenhum banco. */

const silent = { error: vi.fn() }

async function bodyOf(response: Response) {
  return (await response.json()) as {
    error: {
      code: string
      message: string
      fields?: Record<string, string[]>
      details?: Record<string, unknown>
      correlationId?: string
    }
  }
}

describe('serializacao de resposta', () => {
  it('converte bigint em string, sem perder precisao', () => {
    // Ids do modelo sao bigint. Number perderia precisao acima de 2^53.
    const grande = 9007199254740993n
    const response = jsonResponse({ id: grande })
    return response.json().then((body) => {
      expect((body as { id: string }).id).toBe('9007199254740993')
    })
  })

  it('converte data em ISO', async () => {
    const response = jsonResponse({ quando: new Date('2026-09-06T04:20:18.000Z') })
    const body = (await response.json()) as { quando: string }
    expect(body.quando).toBe('2026-09-06T04:20:18.000Z')
  })

  it('percorre arrays e objetos aninhados', async () => {
    const response = jsonResponse({ itens: [{ id: 1n }, { id: 2n }] })
    const body = (await response.json()) as { itens: { id: string }[] }
    expect(body.itens).toEqual([{ id: '1' }, { id: '2' }])
  })

  it('declara JSON com charset', () => {
    expect(jsonResponse({}).headers.get('content-type')).toContain('application/json')
  })
})

describe('mapeamento de erro para status', () => {
  it.each([
    [new ValidationError('x'), 400, 'VALIDATION_FAILED'],
    [new AuthenticationError(), 401, 'NOT_AUTHENTICATED'],
    [new AuthorizationError(), 403, 'NOT_AUTHORIZED'],
    [new NotFoundError(), 404, 'NOT_FOUND'],
    [new RateLimitError(30), 429, 'RATE_LIMITED'],
  ])('mapeia %s', async (error, status, code) => {
    const response = errorResponse(error, silent)
    expect(response.status).toBe(status)
    expect((await bodyOf(response)).error.code).toBe(code)
  })

  it('inclui os campos invalidos na validacao', async () => {
    const response = errorResponse(
      new ValidationError('Dados invalidos.', { type: ['Valor nao permitido.'] }),
      silent,
    )
    expect((await bodyOf(response)).error.fields).toEqual({ type: ['Valor nao permitido.'] })
  })

  it('leva o retry-after no limite de taxa', () => {
    expect(errorResponse(new RateLimitError(45), silent).headers.get('retry-after')).toBe('45')
  })

  it('devolve o conflito com os dados necessarios para resolve-lo', async () => {
    // Decisao 007: reduzir quantidade abaixo do alocado devolve as alocacoes
    // atuais, para o usuario escolher de onde tirar. Um 409 vazio nao resolve.
    const error = new ConflictError('ALLOCATIONS_EXCEED_QUANTITY', 'Alocacoes excedem.', {
      allocations: [{ storageLocationId: '1', quantity: 3 }],
    })
    const response = errorResponse(error, silent)

    expect(response.status).toBe(409)
    const body = await bodyOf(response)
    expect(body.error.code).toBe('ALLOCATIONS_EXCEED_QUANTITY')
    expect(body.error.details).toEqual({
      allocations: [{ storageLocationId: '1', quantity: 3 }],
    })
  })
})

describe('erro inesperado', () => {
  it('vira 500 generico, sem vazar detalhe interno', async () => {
    const logger = { error: vi.fn() }
    const response = errorResponse(
      new Error('relation "users" does not exist at character 42'),
      logger,
    )

    expect(response.status).toBe(500)
    const body = await bodyOf(response)
    expect(body.error.code).toBe('INTERNAL_ERROR')
    // Nem SQL, nem stack trace, nem nome de tabela chegam ao cliente.
    expect(JSON.stringify(body)).not.toContain('users')
    expect(JSON.stringify(body)).not.toContain('character 42')
    // Mas o detalhe vai para o log, associado ao id devolvido.
    expect(body.error.correlationId).toMatch(/^[0-9a-f-]{36}$/)
    expect(logger.error).toHaveBeenCalledOnce()
    expect(String(logger.error.mock.calls[0][0])).toContain(body.error.correlationId as string)
  })

  it('trata valor lancado que nao e Error', async () => {
    const response = errorResponse('algo estranho', silent)
    expect(response.status).toBe(500)
    expect((await bodyOf(response)).error.code).toBe('INTERNAL_ERROR')
  })
})
