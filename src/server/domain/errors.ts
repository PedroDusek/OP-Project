/**
 * Taxonomia de erro do dominio.
 *
 * Camada: domain. Pura, sem HTTP: nenhum codigo de status aparece aqui. O
 * mapeamento para status vive em `http/`, e acontece uma vez so.
 *
 * O motivo de existir uma taxonomia em vez de `throw new Error`: a fronteira
 * HTTP precisa distinguir "o usuario mandou algo invalido" de "o usuario nao
 * pode ver isso" de "quebrou". Sem tipos, essa distincao vira comparacao de
 * string de mensagem, que quebra em silencio quando alguem reescreve a
 * mensagem.
 */

export type AppErrorKind =
  | 'VALIDATION'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT'

export abstract class AppError extends Error {
  abstract readonly kind: AppErrorKind
  /** Codigo estavel, legivel por maquina. O cliente decide o texto exibido. */
  abstract readonly code: string

  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

export class ValidationError extends AppError {
  readonly kind = 'VALIDATION' as const
  readonly code = 'VALIDATION_FAILED'

  constructor(
    message: string,
    /** Mensagens por caminho de campo, para o formulario destacar o campo certo. */
    readonly fields: Record<string, string[]> = {},
  ) {
    super(message)
  }
}

export class AuthenticationError extends AppError {
  readonly kind = 'AUTHENTICATION' as const
  readonly code = 'NOT_AUTHENTICATED'

  constructor(message = 'Autenticacao necessaria.') {
    super(message)
  }
}

export class AuthorizationError extends AppError {
  readonly kind = 'AUTHORIZATION' as const
  readonly code = 'NOT_AUTHORIZED'

  constructor(message = 'Acesso negado.') {
    super(message)
  }
}

export class NotFoundError extends AppError {
  readonly kind = 'NOT_FOUND' as const
  readonly code = 'NOT_FOUND'

  constructor(message = 'Recurso nao encontrado.') {
    super(message)
  }
}

/**
 * Conflito com estado atual. Carrega `details` porque reduzir a quantidade
 * abaixo do que esta alocado precisa devolver as alocacoes atuais para o
 * usuario resolver (decisao 007). Um 409 sem dado nao permite resolver nada.
 */
export class ConflictError extends AppError {
  readonly kind = 'CONFLICT' as const

  constructor(
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

export class RateLimitError extends AppError {
  readonly kind = 'RATE_LIMIT' as const
  readonly code = 'RATE_LIMITED'

  constructor(
    readonly retryAfterSeconds: number,
    message = 'Muitas tentativas. Tente novamente em instantes.',
  ) {
    super(message)
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
