import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { GET as colecao } from '@/app/api/colecao/route'
import { setSessionProvider } from '@/server/application/auth'
import type { ProviderIdentity, SessionProvider } from '@/server/http/session-provider'
import { resetRateLimits } from '@/server/http/rate-limit'
import {
  createCardWithVariant,
  createUser,
  disconnect,
  own,
  resetDatabase,
  testPrisma,
} from '../helpers'

/**
 * As cartas da coleção, página a página (20/09).
 *
 * A rota existe para o "carregar mais" de Minha Coleção, que até então mostrava
 * no máximo 100 cartas e não tinha como ver o resto.
 *
 * O que se protege aqui: exige sessão, devolve **só a coleção de quem pede**, e
 * o recorte das abas é Premium (decisão 093).
 */

let identity: ProviderIdentity | null = null
const fakeSessions: SessionProvider = { name: 'teste', identify: async () => identity }

const url = (qs = '') => `http://localhost/api/colecao${qs}`

interface Pagina {
  items: { variantId: string; cardCode: string; quantity: number }[]
  total: number
  page: number
}

const ler = async (response: Response) => (await response.json()) as Pagina

async function comCartas(quantas: number, prefixo: string) {
  const criada = await createUser('Colecionadora')
  for (let i = 0; i < quantas; i++) {
    const { variant } = await createCardWithVariant(
      'Character',
      `${prefixo}${String(i).padStart(3, '0')}`,
    )
    await own(criada.collection!.id, variant.id, i < 4 ? 4 : 1)
  }
  return criada
}

beforeEach(async () => {
  setSessionProvider(fakeSessions)
  await resetDatabase()
  resetRateLimits()
})

afterAll(async () => {
  setSessionProvider(null)
  await disconnect()
})

describe('GET /api/colecao', () => {
  it('recusa sem sessão', async () => {
    identity = null
    const response = await colecao(new Request(url()), undefined)

    expect(response.status).toBe(401)
  })

  it('devolve as páginas seguintes da própria coleção', async () => {
    const dona = await comCartas(30, 'CO')
    identity = { authUserId: 'auth-dona', email: dona.email, name: 'Colecionadora' }
    await testPrisma().user.update({ where: { id: dona.id }, data: { authUserId: 'auth-dona' } })

    const primeira = await ler(await colecao(new Request(url('?pageSize=24')), undefined))
    const segunda = await ler(await colecao(new Request(url('?pageSize=24&page=2')), undefined))

    expect(primeira.total).toBe(30)
    expect(primeira.items).toHaveLength(24)
    expect(segunda.items).toHaveLength(6)
    // Sem repetir: a segunda leva começa onde a primeira parou.
    const codigos = new Set([...primeira.items, ...segunda.items].map((i) => i.cardCode))
    expect(codigos.size).toBe(30)
  })

  /* A coleção é de quem pede, e nunca de quem o parâmetro disser. */
  it('não mistura a coleção de outra pessoa', async () => {
    const dona = await comCartas(3, 'MI')
    const outra = await comCartas(5, 'OU')
    await testPrisma().user.update({ where: { id: dona.id }, data: { authUserId: 'auth-dona' } })
    await testPrisma().user.update({ where: { id: outra.id }, data: { authUserId: 'auth-outra' } })
    identity = { authUserId: 'auth-dona', email: dona.email, name: 'Colecionadora' }

    const pagina = await ler(await colecao(new Request(url()), undefined))

    expect(pagina.total).toBe(3)
    expect(pagina.items.every((item) => item.cardCode.startsWith('MI'))).toBe(true)
  })

  /*
   * Decisão 093: o recorte das abas é análise da coleção, e análise é Premium.
   * Para o Free ele cai em "todas" — esconder a aba e continuar respondendo ao
   * parâmetro seria trava de fachada.
   */
  it('o recorte só vale para Premium', async () => {
    const dona = await comCartas(6, 'PL')
    await testPrisma().user.update({ where: { id: dona.id }, data: { authUserId: 'auth-dona' } })
    identity = { authUserId: 'auth-dona', email: dona.email, name: 'Colecionadora' }

    const free = await ler(await colecao(new Request(url('?scope=playsets')), undefined))
    expect(free.total).toBe(6)

    await testPrisma().user.update({
      where: { id: dona.id },
      data: { plan: 'PREMIUM', premiumUntil: new Date('2046-01-01') },
    })
    const premium = await ler(await colecao(new Request(url('?scope=playsets')), undefined))
    // Só as quatro primeiras cartas foram criadas com 4 cópias.
    expect(premium.total).toBe(4)
  })

  it('recusa parâmetro desconhecido, como o catálogo', async () => {
    const dona = await comCartas(1, 'PA')
    await testPrisma().user.update({ where: { id: dona.id }, data: { authUserId: 'auth-dona' } })
    identity = { authUserId: 'auth-dona', email: dona.email, name: 'Colecionadora' }

    const response = await colecao(new Request(url('?recorte=playsets')), undefined)

    expect(response.status).toBe(400)
  })
})
