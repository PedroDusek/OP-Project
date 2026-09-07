import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Renovacao do token de sessao.
 *
 * O token de acesso do Supabase expira em cerca de uma hora. Quem renova e
 * quem consegue devolver `Set-Cookie` antes do handler rodar, e esse lugar e o
 * middleware. Sem ele, a pessoa seria deslogada de hora em hora mesmo com um
 * refresh token valido no navegador.
 *
 * O provedor de sessao usado pelas rotas so le cookie, de proposito: escrever em
 * dois lugares diferentes daria duas fontes de verdade para o mesmo cookie.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  // Sem configuracao nao ha o que renovar. A rota decide o que fazer com a
  // ausencia de sessao; o middleware nao derruba a requisicao por isso.
  if (!url || !publishableKey) return NextResponse.next({ request })

  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // Valida e, se preciso, renova. O resultado nao interessa aqui: quem decide
  // acesso e a rota.
  await supabase.auth.getClaims()

  return response
}

export const config = {
  matcher: [
    /*
     * Tudo, menos o que nunca carrega sessao: estaticos do Next, imagens e
     * favicon. Renovar token em requisicao de asset seria trabalho jogado fora
     * em toda imagem de carta da grade.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)',
  ],
}
