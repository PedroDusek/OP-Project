import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { userFromRequest, type AuthenticatedUser } from '@/server/application/auth'
import { appUrl } from './app-url'

/**
 * Quem esta autenticado, do ponto de vista de um Server Component.
 *
 * Camada: http. Existe porque `SessionProvider.identify` recebe um `Request`,
 * que e a forma certa numa route handler, e uma pagina nao tem um. Em vez de
 * dar ao provedor um segundo caminho de entrada — que seria um segundo lugar
 * capaz de decidir quem esta logado — montamos aqui o `Request` a partir dos
 * cabecalhos da requisicao atual.
 *
 * O resultado e uma fonte de verdade so: pagina e rota resolvem sessao pelo
 * mesmo provedor, com o mesmo codigo.
 *
 * Ler `headers()` tambem marca a rota como dinamica, que e o que queremos: uma
 * pagina que depende de quem esta olhando nao pode ser servida de cache
 * estatico.
 */

export async function currentViewer(): Promise<AuthenticatedUser | null> {
  const requestHeaders = await headers()
  const request = new Request(appUrl(), { headers: requestHeaders })
  return userFromRequest(request)
}

/**
 * Exige sessao, ou manda para a tela de entrar.
 *
 * `next` carrega o caminho pedido para a pessoa voltar exatamente onde queria
 * depois de entrar — sem isso, quem abre um link direto para a coleção cai no
 * início e precisa navegar de novo.
 *
 * Isto e conveniencia de navegacao, **nao** e a protecao. A protecao de verdade
 * esta no caso de uso, que verifica a propriedade do recurso contra o usuario
 * da sessao em toda leitura e toda escrita (`architecture.md` 3.5).
 */
export async function requireViewer(pathname: string): Promise<AuthenticatedUser> {
  const viewer = await currentViewer()
  if (viewer) return viewer

  const next = pathname.startsWith('/') && !pathname.startsWith('//') ? pathname : '/inicio'
  redirect(`/entrar?next=${encodeURIComponent(next)}`)
}
