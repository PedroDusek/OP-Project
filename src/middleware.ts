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
  if (!url || !publishableKey) return indexable(request, NextResponse.next({ request: withPathname(request) }))

  let response = NextResponse.next({ request: withPathname(request) })

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request: withPathname(request) })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // Valida e, se preciso, renova. O resultado nao interessa aqui: quem decide
  // acesso e a rota.
  await supabase.auth.getClaims()

  return indexable(request, response)
}

/** O unico endereco que buscadores devem indexar (decisao 092). */
const OFFICIAL_HOSTS = new Set(['colexa.com.br', 'www.colexa.com.br'])

/**
 * Fora do dominio oficial, pede aos buscadores para nao indexar.
 *
 * O site de teste em `colexa.fly.dev` declarava `index, follow` como qualquer
 * pagina: apareceria em busca antes do lancamento, e depois dele viraria copia
 * do dominio oficial. Pelo cabecalho `X-Robots-Tag`, e decidido **por
 * requisicao**, a partir do `Host`: o layout e as paginas estaticas sao montados
 * no build, sem saber em que endereco vao ser servidos. Entre o cabecalho e a
 * meta tag, o buscador obedece a mais restritiva.
 */
function indexable(request: NextRequest, response: NextResponse): NextResponse {
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase()
  if (!OFFICIAL_HOSTS.has(host)) response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}

/**
 * Carrega o caminho atual para dentro da requisicao.
 *
 * Um layout nao tem como saber que rota esta sendo servida — o Next nao expoe
 * isso — e o layout da area autenticada precisa saber, para que quem for
 * mandado ao login volte exatamente onde queria em vez de cair no inicio.
 *
 * O cabecalho e escrito **aqui**, e nao aceito de fora: se viesse do cliente,
 * seria ele quem escolheria o destino do redirecionamento pos-login.
 */
function withPathname(request: NextRequest) {
  const headers = new Headers(request.headers)
  headers.set('x-pathname', request.nextUrl.pathname)
  return { headers }
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
