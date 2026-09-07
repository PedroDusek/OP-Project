import { createServerClient } from '@supabase/ssr'
import type { ProviderIdentity, SessionProvider } from '@/server/http/session-provider'

/**
 * Provedor de sessao apoiado no Supabase Auth (decisao 025).
 *
 * Camada: infrastructure.
 *
 * Usa `getClaims()`, que valida a assinatura do JWT localmente contra as chaves
 * publicas do projeto. As alternativas seriam piores em pontos diferentes:
 * `getSession()` nao revalida o token e por isso nao serve para decidir acesso,
 * e `getUser()` faz uma ida a rede por requisicao, o que a esta altura ja
 * medimos ser caro contra Sao Paulo.
 *
 * Este provedor **so le**. Renovar o token e escrever o cookie novo e trabalho
 * do middleware, que e o unico lugar da requisicao onde da para responder com
 * `Set-Cookie` antes do handler rodar.
 */

interface SupabaseAuthConfig {
  url: string
  publishableKey: string
}

function readConfig(): SupabaseAuthConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !publishableKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY precisam estar definidas.',
    )
  }
  return { url, publishableKey }
}

/** Lê os cookies da requisicao. Nada e escrito daqui: ver comentario acima. */
function cookiesFromRequest(request: Request) {
  const header = request.headers.get('cookie') ?? ''
  const all = header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf('=')
      return index === -1
        ? { name: part, value: '' }
        : { name: part.slice(0, index), value: decodeURIComponent(part.slice(index + 1)) }
    })
  return {
    getAll: () => all,
    setAll: () => {
      /* somente leitura, de proposito */
    },
  }
}

export class SupabaseSessionProvider implements SessionProvider {
  readonly name = 'supabase'

  async identify(request: Request): Promise<ProviderIdentity | null> {
    const { url, publishableKey } = readConfig()
    const supabase = createServerClient(url, publishableKey, {
      cookies: cookiesFromRequest(request),
    })

    const { data, error } = await supabase.auth.getClaims()
    if (error || !data?.claims) return null

    const claims = data.claims as {
      sub?: string
      email?: string
      user_metadata?: { name?: string; full_name?: string }
    }

    // Sem `sub` nao ha a quem atribuir a sessao, e sem e-mail nao ha como criar
    // a conta local. Token incompleto e tratado como ausencia de sessao.
    if (!claims.sub || !claims.email) return null

    return {
      authUserId: claims.sub,
      email: claims.email,
      name: claims.user_metadata?.name ?? claims.user_metadata?.full_name,
    }
  }
}
