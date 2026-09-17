import type { AuthAdmin } from '@/server/http/auth-admin'

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
export class SupabaseAuthAdmin implements AuthAdmin {
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
}
