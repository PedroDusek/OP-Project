/**
 * Contrato da administração de contas no provedor de autenticação.
 *
 * Camada: http. Sem I/O: apenas o formato da operação.
 *
 * Existe para a anonimização (decisões 015 e 091): desfazer o vínculo em
 * `auth_user_id` impede a pessoa de voltar a esta conta, mas deixa e-mail e
 * senha guardados no provedor. Excluir a conta de lá é o que tira o dado
 * pessoal de verdade.
 */
export interface AuthAdmin {
  readonly name: string
  /** `false` quando a chave secreta não está configurada neste ambiente. */
  readonly available: boolean
  /** Exclui a conta no provedor. Já não existir não é erro: é o estado desejado. */
  deleteUser(authUserId: string): Promise<void>
}

/**
 * Listar todas as contas do provedor, para zerar os usuários (19/09).
 *
 * Separado de `AuthAdmin` porque só a limpeza precisa: a anonimização exclui
 * uma conta que ela já conhece. A limpeza precisa também das que nunca
 * ganharam linha em `users` — um cadastro que não confirmou o e-mail existe no
 * provedor e em nenhum outro lugar.
 */
export interface AuthUserDirectory {
  listUsers(): Promise<{ id: string; email: string | null }[]>
}
