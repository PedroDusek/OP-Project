import { randomUUID } from 'node:crypto'
import { isAppError, type AppErrorKind, ConflictError, RateLimitError, ValidationError } from '@/server/domain/errors'

/**
 * Fronteira HTTP: transforma resultado de caso de uso em resposta.
 *
 * Camada: http. E o unico lugar do sistema que conhece codigo de status.
 */

const STATUS_BY_KIND: Record<AppErrorKind, number> = {
  VALIDATION: 400,
  AUTHENTICATION: 401,
  AUTHORIZATION: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMIT: 429,
}

/**
 * O modelo logico especifica `bigint` em todo id, entao eles chegam ao
 * TypeScript como BigInt, que `JSON.stringify` recusa serializar.
 *
 * A conversao para string acontece aqui, uma vez, e nao espalhada por cada
 * rota. String, e nao Number: ids acima de 2^53 perderiam precisao em JSON.
 */
function serialise(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(serialise)
  if (value && typeof value === 'object') {
    // Decimal do Prisma e objetos afins expoem toJSON; respeitamos.
    if (typeof (value as { toJSON?: unknown }).toJSON === 'function') {
      return (value as { toJSON: () => unknown }).toJSON()
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, serialise(v)]),
    )
  }
  return value
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(serialise(data)), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export interface ErrorBody {
  error: {
    code: string
    message: string
    fields?: Record<string, string[]>
    details?: Record<string, unknown>
    correlationId?: string
  }
}

/**
 * Mapeia erro para resposta.
 *
 * Erros de dominio viram status especifico e mensagem propria. Qualquer outra
 * coisa vira 500 com mensagem generica e um id de correlacao: detalhe interno,
 * SQL e stack trace ficam no log, nunca na resposta.
 */
export function errorResponse(
  error: unknown,
  logger: Pick<Console, 'error'> = console,
): Response {
  if (isAppError(error)) {
    const body: ErrorBody = {
      error: { code: error.code, message: error.message },
    }
    if (error instanceof ValidationError && Object.keys(error.fields).length > 0) {
      body.error.fields = error.fields
    }
    if (error instanceof ConflictError && Object.keys(error.details).length > 0) {
      body.error.details = error.details
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json; charset=utf-8',
    }
    if (error instanceof RateLimitError) {
      headers['retry-after'] = String(error.retryAfterSeconds)
    }

    return new Response(JSON.stringify(serialise(body)), {
      status: STATUS_BY_KIND[error.kind],
      headers,
    })
  }

  const correlationId = randomUUID()
  logger.error(`[erro ${correlationId}]`, error)

  const body: ErrorBody = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Erro interno. Se persistir, informe o identificador abaixo.',
      correlationId,
    },
  }
  return jsonResponse(body, 500)
}
