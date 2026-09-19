import type { AuthAdmin, AuthUserDirectory } from '@/server/http/auth-admin'

/**
 * Excluir a conta no Supabase Auth (decisão 091).
 *
 * Camada: infrastructure.
 *
 * `fetch` direto na API de administração, pelo mesmo motivo do Storage
 * (`supabase-image-storage.ts`): o `createClient` exige WebSocket, que o Node 20
 * não tem. Com a chave secreta, porque é uma operação de administrador — só a
 * tarefa diária a usa, nunca uma rota que a pessoa chame.
 */
export class SupabaseAuthAdmin implements AuthAdmin, AuthUserDirectory {
  readonly name = 'supabase-auth-admin'

  private config() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const secretKey = process.env.SUPABASE_SECRET_KEY
    if (!url || !secretKey) return null
    return { base: `${url.replace(/\/+$/, '')}/auth/v1/admin/users`, secretKey }
  }

  get available(): boolean {
    return this.config() !== null
  }

  async deleteUser(authUserId: string): Promise<void> {
    const config = this.config()
    if (!config) throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY precisam estar definidas.')

    const response = await fetch(`${config.base}/${encodeURIComponent(authUserId)}`, {
      method: 'DELETE',
      // `apikey` e `Authorization`: o gateway encaminha pela primeira, o Auth
      // autoriza pela segunda (a mesma exigência do Storage).
      headers: { apikey: config.secretKey, Authorization: `Bearer ${config.secretKey}` },
      signal: AbortSignal.timeout(15_000),
    })
    // Já excluída numa execução anterior que caiu no meio: seguir em frente.
    if (response.ok || response.status === 404) return

    const body = await response.text().catch(() => '')
    throw new Error(`Falha ao excluir a conta no Supabase Auth: ${response.status} ${body}`.trim())
  }

  /** Todas as contas, página a página: a API devolve no máximo 1.000 por vez. */
  async listUsers(): Promise<{ id: string; email: string | null }[]> {
    const config = this.config()
    if (!config) throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY precisam estar definidas.')

    const todas: { id: string; email: string | null }[] = []
    for (let pagina = 1; ; pagina++) {
      const response = await fetch(`${config.base}?page=${pagina}&per_page=1000`, {
        headers: { apikey: config.secretKey, Authorization: `Bearer ${config.secretKey}` },
        signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`Falha ao listar as contas do Supabase Auth: ${response.status} ${body}`.trim())
      }
      const { users } = (await response.json()) as { users: { id: string; email?: string | null }[] }
      todas.push(...users.map((user) => ({ id: user.id, email: user.email ?? null })))
      if (users.length < 1000) return todas
    }
  }
}
