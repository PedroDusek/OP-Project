import { NextResponse } from 'next/server'
import { completeOAuth } from '@/server/application/auth/credentials'
import { appUrl } from '@/server/http/app-url'
import { requestCookies } from '@/server/http/next-cookies'

/**
 * Volta dos links que criam sessao: confirmacao de e-mail, redefinicao de senha
 * e provedores sociais.
 *
 * Os tres chegam aqui com um `code` de uso unico, que e trocado por sessao. E
 * uma rota, e nao uma pagina, porque a troca precisa **escrever cookie** antes
 * de qualquer HTML sair.
 *
 * Precisa estar em *Redirect URLs* no painel do Supabase para cada ambiente. Ver
 * `docs/development.md`.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const base = appUrl()

  // Só caminho interno: `next` vem da query, e sem esta checagem o link de
  // confirmação viraria um redirecionamento aberto assinado por nós.
  const requested = url.searchParams.get('next') ?? '/inicio'
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/inicio'

  if (!code) {
    // O provedor recusou, ou a pessoa cancelou no meio do fluxo social.
    const description = url.searchParams.get('error_description')
    return NextResponse.redirect(errorUrl(base, description ?? 'Link inválido ou incompleto.'))
  }

  try {
    await completeOAuth(code, { cookies: await requestCookies(), appUrl: base })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Não foi possível concluir. Tente de novo.'
    return NextResponse.redirect(errorUrl(base, message))
  }

  return NextResponse.redirect(new URL(next, base))
}

function errorUrl(base: string, message: string): URL {
  const url = new URL('/entrar', base)
  url.searchParams.set('erro', message)
  return url
}
