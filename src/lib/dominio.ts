/**
 * O endereço antigo leva ao oficial (21/09).
 *
 * `colexa.fly.dev` continua respondendo — a Fly serve o app por ele, e não há
 * como desligar — e um link antigo aberto ali criaria uma segunda versão do
 * site: sessão em outro domínio, e o buscador vendo o mesmo conteúdo em dois
 * endereços.
 *
 * A regra mora aqui, pura, e o middleware só a aplica: no middleware ela seria
 * testável apenas com o Next de pé, e os casos que importam — o laço, a
 * checagem de saúde — são exatamente os que ninguém testa à mão.
 */

/**
 * O destino, ou `null` quando não há para onde ir.
 *
 * @param host      o `Host` da requisição, possivelmente com porta e maiúsculas
 * @param pathname  o caminho pedido
 * @param search    a query, com `?`, ou vazia
 * @param oficial   o endereço oficial (`APP_URL`), quando existe
 */
export function rotaParaOficial(
  host: string | null,
  pathname: string,
  search: string,
  oficial: string | undefined,
): string | null {
  if (!oficial) return null

  const limpo = (host ?? '').split(':')[0].trim().toLowerCase()
  if (!limpo.endsWith('.fly.dev')) return null

  /*
   * A checagem de saúde fica fora: a Fly espera 2xx dela, e um 308 seria lido
   * como máquina doente — o que derrubaria a publicação inteira.
   */
  if (pathname === '/api/saude') return null

  let destino: URL
  try {
    destino = new URL(pathname + search, oficial)
  } catch {
    return null
  }

  // Nunca um laço: se o destino for o próprio host, segue a requisição normal.
  if (destino.host.split(':')[0].toLowerCase() === limpo) return null

  return destino.toString()
}
