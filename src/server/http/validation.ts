import type { ZodType } from 'zod'
import { ValidationError } from '@/server/domain/errors'

/**
 * Validacao de entrada na fronteira HTTP.
 *
 * Camada: http. Nenhum caso de uso recebe dado nao validado, e nenhum caso de
 * uso valida formato: aqui garante-se o formato, la garante-se a regra.
 */

/** Converte falha do Zod em ValidationError com mensagens por campo. */
export function parseOrThrow<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (result.success) return result.data

  const fields: Record<string, string[]> = {}
  for (const issue of result.error.issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : '_'
    ;(fields[path] ??= []).push(issue.message)
  }
  throw new ValidationError('Dados invalidos.', fields)
}

/**
 * Query string para objeto simples.
 *
 * Parametros repetidos ficam como o ultimo valor. O catalogo nao tem filtro
 * multivalorado hoje, e aceitar array em silencio esconderia um erro de cliente.
 */
export function queryToObject(url: URL): Record<string, string> {
  return Object.fromEntries(url.searchParams.entries())
}

/** Corpo JSON, com corpo malformado virando erro de validacao e nao 500. */
export async function jsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new ValidationError('Corpo da requisicao nao e JSON valido.')
  }
}
