import { getCardVariant } from '@/server/application/catalog'
import { CATALOG_READ_LIMIT, consumeRateLimit } from '@/server/http/rate-limit'
import { jsonResponse } from '@/server/http/response'
import { route } from '@/server/http/route'
import { variantIdSchema } from '@/server/http/schemas/catalog'
import { requireUser } from '@/server/http/session'
import { parseOrThrow } from '@/server/http/validation'

interface Context {
  params: Promise<{ variantId: string }>
}

/** Detalhe de uma variante. Exige sessao, pelo mesmo motivo da listagem. */
export const GET = route<Context>(async (request, context) => {
  const user = await requireUser(request)
  // Cota por usuario: limitar por rota deixaria um usuario derrubar todos.
  consumeRateLimit(`catalog:${user.id}`, CATALOG_READ_LIMIT)

  const { variantId } = await context.params
  const id = parseOrThrow(variantIdSchema, variantId)
  const variant = await getCardVariant(id)

  return jsonResponse(variant)
})
