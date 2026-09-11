import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { GET as catalogDetail } from '@/app/api/catalog/[variantId]/route'
import { GET as catalogSearch } from '@/app/api/catalog/route'
import { importCatalog } from '@/server/application/catalog/import-catalog'
import { parseCardList } from '@/server/domain/catalog/parse-card-list'
import type { CatalogProvider } from '@/server/domain/catalog/types'
import { setSessionProvider } from '@/server/application/auth'
import type { ProviderIdentity, SessionProvider } from '@/server/http/session-provider'
import { resetRateLimits } from '@/server/http/rate-limit'
import { disconnect, resetDatabase, resetUserData, testPrisma } from '../helpers'

const html = readFileSync(
  fileURLToPath(new URL('../fixtures/bandai-cardlist-sample.html', import.meta.url)),
  'utf8',
)

const catalogProvider: CatalogProvider = {
  name: 'bandai',
  listSeriesIds: async () => ['569117'],
  fetchSeries: async () => parseCardList(html),
}

/** Provedor de sessao de teste: nenhuma rede, identidade controlada pelo teste. */
let identity: ProviderIdentity | null = null
const fakeSessions: SessionProvider = {
  name: 'teste',
  identify: async () => identity,
}

const url = (qs = '') => `http://localhost/api/catalog${qs}`

async function body(response: Response): Promise<Record<string, never>> {
  return (await response.json()) as Record<string, never>
}

beforeAll(async () => {
  setSessionProvider(fakeSessions)
  await resetDatabase()
  await importCatalog(testPrisma(), catalogProvider, {
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  })
})

beforeEach(async () => {
  resetRateLimits()
  identity = { authUserId: 'auth-1', email: 'Pessoa@Example.Test', name: 'Pessoa' }
  // O catalogo e importado uma vez; os dados de usuario nascem limpos a cada
  // teste, para que um teste nao dependa nem estrague o estado de outro.
  await resetUserData()
})

afterAll(async () => {
  setSessionProvider(null)
  await disconnect()
})

describe('GET /api/catalog', () => {
  it('recusa sem sessao, com 401 e mensagem generica', async () => {
    identity = null
    const response = await catalogSearch(new Request(url()), undefined)
    expect(response.status).toBe(401)

    const payload = (await body(response)) as unknown as { error: { code: string } }
    expect(payload.error.code).toBe('NOT_AUTHENTICATED')
  })

  it('devolve a primeira pagina com sessao valida', async () => {
    const response = await catalogSearch(new Request(url()), undefined)
    expect(response.status).toBe(200)

    const payload = (await body(response)) as unknown as {
      items: { variantId: string; cardCode: string }[]
      total: number
    }
    expect(payload.total).toBe(6)
    // Ids sao bigint no modelo e viram string no JSON, sem perder precisao.
    expect(typeof payload.items[0].variantId).toBe('string')
  })

  it('cria o usuario e a colecao na primeira visita', async () => {
    const db = testPrisma()
    expect(await db.user.count()).toBe(0)

    await catalogSearch(new Request(url()), undefined)

    const user = await db.user.findFirstOrThrow({ include: { collection: true } })
    expect(user.authUserId).toBe('auth-1')
    // E-mail normalizado em minusculas.
    expect(user.email).toBe('pessoa@example.test')
    // Toda pessoa tem exatamente uma colecao, e ela nasce vazia.
    expect(user.collection).not.toBeNull()
    expect(await db.collectionItem.count()).toBe(0)
  })

  it('nao duplica o usuario em visitas seguintes', async () => {
    await catalogSearch(new Request(url()), undefined)
    await catalogSearch(new Request(url()), undefined)
    expect(await testPrisma().user.count()).toBe(1)
  })

  it('recusa sessao de conta anonimizada', async () => {
    await catalogSearch(new Request(url()), undefined)
    await testPrisma().user.updateMany({ data: { deletedAt: new Date() } })

    const response = await catalogSearch(new Request(url()), undefined)
    expect(response.status).toBe(401)
  })

  it('aplica os filtros da query', async () => {
    const response = await catalogSearch(new Request(url('?code=OP17-005')), undefined)
    const payload = (await body(response)) as unknown as { total: number }
    expect(payload.total).toBe(2)
  })

  it('rejeita filtro invalido com 400 e aponta o campo', async () => {
    const response = await catalogSearch(new Request(url('?type=Don')), undefined)
    expect(response.status).toBe(400)

    const payload = (await body(response)) as unknown as {
      error: { code: string; fields: Record<string, string[]> }
    }
    expect(payload.error.code).toBe('VALIDATION_FAILED')
    expect(Object.keys(payload.error.fields)).toContain('type')
  })

  it('rejeita pageSize acima do teto em vez de reduzir em silencio', async () => {
    const response = await catalogSearch(new Request(url('?pageSize=5000')), undefined)
    expect(response.status).toBe(400)
  })

  it('rejeita numero malformado', async () => {
    const response = await catalogSearch(new Request(url('?costMin=muito')), undefined)
    expect(response.status).toBe(400)
  })

  /**
   * Descarte silencioso e pior que rejeicao: `?custo=3`, em portugues ou com um
   * typo, devolveria o catalogo inteiro e quem chamou acharia que filtrou.
   */
  it('rejeita parametro desconhecido em vez de ignorar', async () => {
    const response = await catalogSearch(new Request(url('?custo=3')), undefined)
    expect(response.status).toBe(400)
  })
})

describe('GET /api/catalog/[variantId]', () => {
  const context = (variantId: string) => ({ params: Promise.resolve({ variantId }) })

  it('recusa sem sessao', async () => {
    identity = null
    const response = await catalogDetail(new Request(url('/1')), context('1'))
    expect(response.status).toBe(401)
  })

  it('devolve a carta com vocabulario, sets e as demais artes', async () => {
    const variant = await testPrisma().cardVariant.findFirstOrThrow({
      where: { sourceId: 'OP17-005' },
    })
    const response = await catalogDetail(
      new Request(url(`/${variant.id}`)),
      context(variant.id.toString()),
    )
    expect(response.status).toBe(200)

    const payload = (await body(response)) as unknown as {
      card: { code: string; colors: string[]; traits: string[] }
      sets: { code: string }[]
      siblings: { current: boolean }[]
    }
    expect(payload.card.code).toBe('OP17-005')
    expect(payload.card.colors.length).toBeGreaterThan(0)
    expect(payload.sets.length).toBeGreaterThan(0)
    // As duas artes da carta, com a atual marcada.
    expect(payload.siblings).toHaveLength(2)
    expect(payload.siblings.filter((s) => s.current)).toHaveLength(1)
  })

  it('devolve 404 para variante inexistente', async () => {
    const response = await catalogDetail(new Request(url('/999999')), context('999999'))
    expect(response.status).toBe(404)

    const payload = (await body(response)) as unknown as { error: { code: string } }
    expect(payload.error.code).toBe('NOT_FOUND')
  })

  it('devolve 400 para identificador que nao e numero', async () => {
    const response = await catalogDetail(new Request(url('/abc')), context('abc'))
    expect(response.status).toBe(400)
  })
})

/**
 * Parametro repetido na rota.
 *
 * Antes, `queryToObject` ficava com o ultimo valor: `?color=Black&color=Blue`
 * filtrava so por azul, em silencio. Descarte silencioso e pior que rejeicao —
 * e aqui nao havia nem rejeicao.
 */
describe('filtros repetidos na API', () => {
  it('aceita o mesmo filtro duas vezes e soma os dois', async () => {
    const types = await testPrisma().card.findMany({ select: { type: true }, distinct: ['type'] })
    const [first, second] = types.map((t) => t.type)
    expect(second).toBeDefined()

    const juntos = await body(
      await catalogSearch(new Request(url(`?type=${first}&type=${second}`)), undefined),
    )
    const um = await body(await catalogSearch(new Request(url(`?type=${first}`)), undefined))
    const outro = await body(
      await catalogSearch(new Request(url(`?type=${second}`)), undefined),
    )

    expect(Number(juntos.total)).toBe(Number(um.total) + Number(outro.total))
  })

  it('um valor so continua funcionando', async () => {
    const response = await catalogSearch(new Request(url('?type=Leader')), undefined)
    expect(response.status).toBe(200)
  })

  /** Valor invalido dentro da lista e 400, e nao filtro parcial em silencio. */
  it('recusa a lista com um valor invalido', async () => {
    const response = await catalogSearch(new Request(url('?type=Leader&type=Navio')), undefined)
    expect(response.status).toBe(400)
  })

  /** Cada valor vira item de `IN`; uma URL com mil deles seria consulta cara de graca. */
  it('recusa lista longa demais', async () => {
    const many = Array.from({ length: 21 }, (_, i) => `color=Cor${i}`).join('&')
    const response = await catalogSearch(new Request(url(`?${many}`)), undefined)
    expect(response.status).toBe(400)
  })
})

/**
 * O filtro de counter pela API, que e por onde a rolagem infinita pede as
 * paginas seguintes. Um filtro que valesse na primeira pagina e sumisse nas
 * outras so apareceria para quem rolasse.
 */
describe('GET /api/catalog com counter', () => {
  it('aceita a lista de valores e so devolve personagem', async () => {
    const response = await catalogSearch(
      new Request(url('?counter=0&counter=2000&pageSize=100')),
      undefined,
    )
    expect(response.status).toBe(200)

    const payload = (await body(response)) as unknown as {
      items: { type: string; counter: number | null }[]
    }
    for (const item of payload.items) {
      expect(item.type).toBe('Character')
      expect([null, 2000]).toContain(item.counter)
    }
  })

  /* So os tres valores do jogo passam. Qualquer outro e erro, e nao silencio. */
  it('rejeita valor que nao e do jogo, apontando o campo', async () => {
    const response = await catalogSearch(new Request(url('?counter=500')), undefined)
    expect(response.status).toBe(400)

    const payload = (await body(response)) as unknown as {
      error: { fields: Record<string, string[]> }
    }
    expect(Object.keys(payload.error.fields)).toContain('counter')
  })
})
