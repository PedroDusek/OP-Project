import { isPremium } from '@/server/application/authorization'
import { jsonResponse } from '@/server/http/response'
import { route } from '@/server/http/route'
import { requireUser } from '@/server/http/session'

/**
 * Quem esta autenticado.
 *
 * Devolve so o que a interface precisa para se desenhar: nome, e-mail e se a
 * pessoa tem acesso Premium. Nada de `auth_user_id`, que e identificador do
 * provedor e nao tem por que sair daqui.
 */
export const GET = route(async (request: Request) => {
  const user = await requireUser(request)

  return jsonResponse({
    id: user.id,
    name: user.name,
    email: user.email,
    plan: user.plan,
    premium: isPremium(user),
  })
})
