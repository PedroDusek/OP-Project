import { getCardVariant } from '@/server/application/catalog'
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
  await requireUser(request)

  const { variantId } = await context.params
  const id = parseOrThrow(variantIdSchema, variantId)
  const variant = await getCardVariant(id)

  return jsonResponse(variant)
})
