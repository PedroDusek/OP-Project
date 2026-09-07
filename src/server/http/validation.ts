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
 * Parametro repetido vira lista; parametro unico continua string. Quem valida
 * decide se aceita as duas formas — o filtro do catalogo aceita, porque cor e
 * raridade sao multivalorados.
 *
 * Antes disto, repetidos ficavam com o ultimo valor: `?cor=Black&cor=Blue`
 * filtrava so por azul, em silencio. Descarte silencioso e pior que rejeicao,
 * e aqui nao havia nem rejeicao.
 */
export function queryToObject(url: URL): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {}

  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key)
    result[key] = values.length > 1 ? values : values[0]
  }

  return result
}

/** Corpo JSON, com corpo malformado virando erro de validacao e nao 500. */
export async function jsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new ValidationError('Corpo da requisicao nao e JSON valido.')
  }
}
