/**
 * Contrato do provedor de autenticacao.
 *
 * Camada: http. Sem I/O e sem persistencia: apenas o formato da identidade que
 * um provedor externo devolve. O provedor e externo (decisao 025), mas o resto
 * do sistema nao fala com ele, fala com esta interface. Trocar de provedor mexe
 * numa implementacao, nao nas rotas nem nos casos de uso.
 */
export interface ProviderIdentity {
  /** Id do usuario no provedor. Vai para users.auth_user_id. */
  authUserId: string
  email: string
  name?: string
}

export interface SessionProvider {
  readonly name: string
  /** Identidade da requisicao, ou null quando nao ha sessao valida. */
  identify(request: Request): Promise<ProviderIdentity | null>
}
