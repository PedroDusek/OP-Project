/**
 * A URL base da aplicacao.
 *
 * Camada: http. Existe porque os links que o provedor manda por e-mail —
 * confirmacao de conta e redefinicao de senha — precisam voltar para **este**
 * ambiente, e o servidor nao consegue adivinhar isso a partir da requisicao com
 * seguranca: o cabecalho `Host` vem do cliente.
 *
 * Confiar no `Host` aqui seria grave. Quem controla o cabecalho controlaria para
 * onde o link de redefinicao de senha aponta, e o link carrega um codigo que
 * cria sessao. Por isso vem de variavel de ambiente e de mais lugar nenhum.
 */
export function appUrl(): string {
  const configured = process.env.APP_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')

  // Sem configuracao, so o desenvolvimento local segue. Em producao, um link de
  // e-mail apontando para localhost e pior do que falhar na hora.
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000'

  throw new Error('APP_URL precisa estar definida para montar os links de e-mail.')
}
