import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { GET as me } from '@/app/api/me/route'
import { GET as catalogSearch } from '@/app/api/catalog/route'
import { setSessionProvider } from '@/server/application/auth'
import type { ProviderIdentity, SessionProvider } from '@/server/http/session-provider'
import { CATALOG_READ_LIMIT, resetRateLimits } from '@/server/http/rate-limit'
import { disconnect, resetDatabase, testPrisma } from '../helpers'

let identity: ProviderIdentity | null = null
const fakeSessions: SessionProvider = { name: 'teste', identify: async () => identity }

async function body<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

beforeEach(async () => {
  setSessionProvider(fakeSessions)
  resetRateLimits()
  await resetDatabase()
  identity = { authUserId: 'auth-1', email: 'pessoa@example.test', name: 'Pessoa' }
})

afterAll(async () => {
  setSessionProvider(null)
  await disconnect()
})

describe('GET /api/me', () => {
  it('recusa sem sessao', async () => {
    identity = null
    const response = await me(new Request('http://localhost/api/me'), undefined)
    expect(response.status).toBe(401)
  })

  it('devolve o usuario da sessao', async () => {
    const response = await me(new Request('http://localhost/api/me'), undefined)
    expect(response.status).toBe(200)

    const payload = await body<{ email: string; name: string; plan: string; premium: boolean }>(
      response,
    )
    expect(payload.email).toBe('pessoa@example.test')
    expect(payload.name).toBe('Pessoa')
    expect(payload.plan).toBe('FREE')
    expect(payload.premium).toBe(false)
  })

  it('nao vaza o identificador do provedor', async () => {
    // auth_user_id e identidade no Supabase e nao tem por que sair daqui.
    const response = await me(new Request('http://localhost/api/me'), undefined)
    const raw = JSON.stringify(await body(response))
    expect(raw).not.toContain('auth-1')
    expect(raw).not.toContain('authUserId')
  })

  it('reflete Premium dentro do prazo', async () => {
    await me(new Request('http://localhost/api/me'), undefined)
    await testPrisma().user.updateMany({
      data: { plan: 'PREMIUM', premiumUntil: new Date(Date.now() + 86_400_000) },
    })

    const response = await me(new Request('http://localhost/api/me'), undefined)
    const payload = await body<{ premium: boolean }>(response)
    expect(payload.premium).toBe(true)
  })

  it('nao concede Premium vencido', async () => {
    await me(new Request('http://localhost/api/me'), undefined)
    await testPrisma().user.updateMany({
      data: { plan: 'PREMIUM', premiumUntil: new Date(Date.now() - 86_400_000) },
    })

    const response = await me(new Request('http://localhost/api/me'), undefined)
    expect((await body<{ premium: boolean }>(response)).premium).toBe(false)
  })

  it('recusa conta anonimizada, mesmo com sessao valida no provedor', async () => {
    await me(new Request('http://localhost/api/me'), undefined)
    await testPrisma().user.updateMany({ data: { deletedAt: new Date() } })

    const response = await me(new Request('http://localhost/api/me'), undefined)
    expect(response.status).toBe(401)
  })
})

describe('a sessao e a unica fonte da identidade', () => {
  it('ignora user_id vindo da query', async () => {
    const db = testPrisma()
    await me(new Request('http://localhost/api/me'), undefined)
    const mine = await db.user.findFirstOrThrow()

    // Alguem tenta se passar por outro id na propria requisicao.
    const response = await me(
      new Request(`http://localhost/api/me?userId=${mine.id + 999n}&user_id=999`),
      undefined,
    )

    const payload = await body<{ id: string }>(response)
    expect(payload.id).toBe(mine.id.toString())
  })
})

describe('limite de taxa do catalogo', () => {
  it('libera dentro da cota', async () => {
    for (let i = 0; i < 5; i += 1) {
      const response = await catalogSearch(new Request('http://localhost/api/catalog'), undefined)
      expect(response.status).toBe(200)
    }
  })

  it('responde 429 com retry-after ao estourar', async () => {
    const url = 'http://localhost/api/catalog'
    for (let i = 0; i < CATALOG_READ_LIMIT.limit; i += 1) {
      await catalogSearch(new Request(url), undefined)
    }

    const blocked = await catalogSearch(new Request(url), undefined)
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0)

    const payload = await body<{ error: { code: string } }>(blocked)
    expect(payload.error.code).toBe('RATE_LIMITED')
  })

  it('a cota e por usuario: estourar a de um nao afeta o outro', async () => {
    const url = 'http://localhost/api/catalog'
    for (let i = 0; i <= CATALOG_READ_LIMIT.limit; i += 1) {
      await catalogSearch(new Request(url), undefined)
    }
    expect((await catalogSearch(new Request(url), undefined)).status).toBe(429)

    identity = { authUserId: 'auth-2', email: 'outra@example.test', name: 'Outra' }
    expect((await catalogSearch(new Request(url), undefined)).status).toBe(200)
  })
})
