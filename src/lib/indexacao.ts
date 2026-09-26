/**
 * Quem pode aparecer em busca (decisão 092, ajustada em 21/09).
 *
 * Duas condições, e as duas precisam valer: estar no **domínio oficial** e a
 * indexação estar **ligada** por configuração.
 *
 * A segunda nasceu ao migrar para `colexa.com.br`. Sem ela, trocar de endereço
 * ligaria a indexação junto — e no dia em que isso acontecesse os Termos ainda
 * diriam "em preparação" e o cadastro estaria aberto a quem tivesse o link.
 * Sair do Google depois é demorado, e o endereço fica no cache deles; entrar é
 * rápido. Então quem decide o dia é o dono do produto, com uma variável de
 * ambiente, sem publicar código novo.
 */

/** O único endereço que buscadores devem indexar. */
export const OFFICIAL_HOSTS = new Set(['colexa.com.br', 'www.colexa.com.br'])

/** `1`, `true` ou `sim` liberam. Qualquer outra coisa, inclusive ausência, não. */
export function indexingAllowed(valor: string | undefined): boolean {
  const limpo = (valor ?? '').trim().toLowerCase()
  return limpo === '1' || limpo === 'true' || limpo === 'sim'
}

/**
 * O `Host` vem com porta em desenvolvimento e pode vir em maiúsculas; as duas
 * coisas já derrubaram comparação de domínio em produção alheia.
 */
export function podeIndexar(host: string | null, allowIndexing: string | undefined): boolean {
  const limpo = (host ?? '').split(':')[0].trim().toLowerCase()
  return OFFICIAL_HOSTS.has(limpo) && indexingAllowed(allowIndexing)
}

/**
 * O endereço do site, para quando ele viaja como texto.
 *
 * URL inteira de propósito: é o que faz o aplicativo de mensagens transformar
 * em link clicável. `colexa.com.br` solto costuma virar texto morto.
 *
 * Mora junto de `OFFICIAL_HOSTS` porque é a mesma verdade — se um dia o
 * endereço mudar, os dois mudam no mesmo lugar.
 */
export const SITE_URL = 'https://colexa.com.br'
