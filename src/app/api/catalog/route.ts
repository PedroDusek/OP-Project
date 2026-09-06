import { searchCatalog } from '@/server/application/catalog'
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
  await requireUser(request)

  const query = parseOrThrow(catalogQuerySchema, queryToObject(new URL(request.url)))
  const result = await searchCatalog(query)

  return jsonResponse(result)
})
