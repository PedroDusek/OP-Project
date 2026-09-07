import { searchCatalog } from '@/server/application/catalog'
import { CATALOG_READ_LIMIT, consumeRateLimit } from '@/server/http/rate-limit'
import { jsonResponse } from '@/server/http/response'
import { route } from '@/server/http/route'
import { catalogQuerySchema } from '@/server/http/schemas/catalog'
import { requireUser } from '@/server/http/session'
import { parseOrThrow, queryToObject } from '@/server/http/validation'

/**
 * Busca no catalogo.
 *
 * Exige sessao. Isto nao e zelo excessivo: a decisao 020 assume o compromisso
 * de nunca reexpor o catalogo como API publica, e uma rota aberta de busca
 * seria exatamente isso.
 */
export const GET = route(async (request: Request) => {
  const user = await requireUser(request)
  // Cota por usuario: limitar por rota deixaria um usuario derrubar todos.
  consumeRateLimit(`catalog:${user.id}`, CATALOG_READ_LIMIT)

  const query = parseOrThrow(catalogQuerySchema, queryToObject(new URL(request.url)))
  const result = await searchCatalog(query)

  return jsonResponse(result)
})
