import { errorResponse } from './response'

/**
 * Envelope de rota.
 *
 * Camada: http. Existe para que nenhum handler precise repetir try/catch, e
 * principalmente para que nenhum handler possa esquecer dele: sem isto, uma
 * excecao nao tratada vaza stack trace na resposta.
 */
export type RouteHandler<C = unknown> = (request: Request, context: C) => Promise<Response>

export function route<C = unknown>(handler: RouteHandler<C>): RouteHandler<C> {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (error) {
      return errorResponse(error)
    }
  }
}
