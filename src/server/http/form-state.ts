import { randomUUID } from 'node:crypto'
import { isAppError, RateLimitError, ValidationError } from '@/server/domain/errors'

/**
 * Fronteira de Server Action: transforma erro de caso de uso em estado de
 * formulario.
 *
 * Camada: http. E o equivalente de `errorResponse` para acoes, e existe pelo
 * mesmo motivo: a mesma taxonomia de erro precisa chegar ao cliente sempre da
 * mesma forma, mapeada num lugar so.
 *
 * A diferenca de destino e que aqui nao ha status HTTP — o formulario precisa
 * saber **qual campo** destacar e **o que dizer** acima do botao.
 *
 * O que nao muda: detalhe interno, texto de SQL e stack trace nunca saem daqui.
 * Erro inesperado vira mensagem generica com um id de correlacao, e o resto
 * fica no log.
 */

export interface FormError {
  status: 'error'
  message: string
  /** Mensagens por campo, na mesma chave do `name` do input. */
  fields: Record<string, string[]>
}

export function formError(message: string, fields: Record<string, string[]> = {}): FormError {
  return { status: 'error', message, fields }
}

export function formErrorFrom(
  error: unknown,
  logger: Pick<Console, 'error'> = console,
): FormError {
  if (error instanceof ValidationError) {
    /*
     * Quando ha erro por campo, a mensagem geral fica vazia: repetir "Dados
     * invalidos" acima de campos que ja dizem o que ha de errado so acrescenta
     * ruido a uma tela que a pessoa esta tentando resolver.
     */
    const hasFieldErrors = Object.keys(error.fields).length > 0
    return {
      status: 'error',
      message: hasFieldErrors ? '' : error.message,
      fields: error.fields,
    }
  }

  if (error instanceof RateLimitError) {
    return formError(retryMessage(error.retryAfterSeconds))
  }

  if (isAppError(error)) {
    return formError(error.message)
  }

  const correlationId = randomUUID()
  logger.error(`[erro ${correlationId}]`, error)
  return formError(
    `Erro interno. Se persistir, informe o identificador ${correlationId}.`,
  )
}

function retryMessage(seconds: number): string {
  if (seconds <= 90) {
    return `Muitas tentativas. Tente de novo em ${Math.ceil(seconds)} segundos.`
  }
  const minutes = Math.ceil(seconds / 60)
  return `Muitas tentativas. Tente de novo em ${minutes} minutos.`
}
