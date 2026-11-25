import { searchCollection } from '@/server/application/collection'
import { CATALOG_READ_LIMIT, consumeRateLimit } from '@/server/http/rate-limit'
import { jsonResponse } from '@/server/http/response'
import { route } from '@/server/http/route'
import { catalogQuerySchema } from '@/server/http/schemas/catalog'
import { requireUser } from '@/server/http/session'
import { parseOrThrow, queryToObject } from '@/server/http/validation'

/**
 * As cartas da coleção de quem está pedindo, página a página.
 *
 * Existe para o "carregar mais" de Minha Coleção (20/09). Até aqui a tela
 * mostrava no máximo 100 cartas e não tinha como ver o resto — o testador com
 * 131 cartas simplesmente não via 31 delas.
 *
 * **Só a própria coleção.** O `user` vem da sessão, nunca da consulta: uma rota
 * que aceitasse o id de outra pessoa seria uma forma de ler a coleção alheia.
 *
 * A cota é a mesma do catálogo, pelo mesmo motivo (decisão 020): a rolagem não
 * pode virar o caminho conveniente de baixar tudo.
 */
export const GET = route(async (request: Request) => {
  const user = await requireUser(request)
  consumeRateLimit(`catalog:${user.id}`, CATALOG_READ_LIMIT)

  const query = parseOrThrow(catalogQuerySchema, queryToObject(new URL(request.url)))

  /*
   * Nao ha recorte aqui desde a decisao 114. Havia `scope`, Premium, que a
   * rota rebaixava para "todas" no Free; os recortes sairam da colecao e
   * playset passou a ter destino proprio. O schema e `.strict()`, entao um
   * endereco antigo com `scope=` e recusado em vez de ignorado em silencio.
   */
  const result = await searchCollection(user, query)

  return jsonResponse({
    ...result,
    items: result.items.map((item) => ({ ...item, variantId: String(item.variantId) })),
  })
})
