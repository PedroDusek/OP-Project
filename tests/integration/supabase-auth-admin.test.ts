import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseAuthAdmin } from '@/server/infrastructure/auth/supabase-auth-admin'

/**
 * Excluir a conta no Supabase Auth, contra um `fetch` de mentira (decisão 091).
 * Nenhum teste toca a rede.
 */

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://projeto.supabase.co/')
  vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_teste')
  fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('SupabaseAuthAdmin', () => {
  it('sem a chave secreta, se declara indisponível e não chama nada', async () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', '')
    const admin = new SupabaseAuthAdmin()
    expect(admin.available).toBe(false)
    await expect(admin.deleteUser('abc')).rejects.toThrow('SUPABASE_SECRET_KEY')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('exclui pela API de administração, com a chave nos dois cabeçalhos', async () => {
    await new SupabaseAuthAdmin().deleteUser('3f1c-uuid')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://projeto.supabase.co/auth/v1/admin/users/3f1c-uuid')
    expect(init.method).toBe('DELETE')
    expect(init.headers).toMatchObject({ apikey: 'sb_secret_teste', Authorization: 'Bearer sb_secret_teste' })
  })

  it('conta que já não existe é sucesso; outro erro sobe', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"msg":"User not found"}', { status: 404 }))
    await expect(new SupabaseAuthAdmin().deleteUser('sumiu')).resolves.toBeUndefined()

    fetchMock.mockResolvedValueOnce(new Response('fora do ar', { status: 503 }))
    await expect(new SupabaseAuthAdmin().deleteUser('abc')).rejects.toThrow('503')
  })
})
