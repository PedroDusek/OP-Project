import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { searchCatalog } from '@/server/application/catalog/search-cards'
import type { CardType } from '@/server/domain/catalog/types'
import { createVariant, disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * O filtro de counter, contra o banco.
 *
 * As cartas daqui sao criadas pelo proprio teste, com o counter exato, em vez de
 * vir da amostra da Bandai: a regra que se testa depende de ter um personagem de
 * cada counter, um sem counter e cartas de outros tipos — e a amostra nao
 * promete nada disso.
 *
 * A regra (escolha do dono do produto): o zero e **personagem sem counter**, e
 * com qualquer valor marcado o resultado fica so em personagens.
 */

async function carta(code: string, type: CardType, counter: number | null) {
  const card = await testPrisma().card.create({
    data: { code, name: `Carta ${code}`, type, counter },
  })
  await createVariant(card.id)
}

beforeAll(async () => {
  await resetDatabase()
  await carta('CT-001', 'Character', 1000)
  await carta('CT-002', 'Character', 2000)
  await carta('CT-003', 'Character', null)
  await carta('CT-004', 'Event', null)
  await carta('CT-005', 'Leader', null)
  await carta('CT-006', 'Stage', null)
})

afterAll(async () => {
  await disconnect()
})

async function codigos(query: Parameters<typeof searchCatalog>[1]) {
  const result = await searchCatalog(testPrisma(), { pageSize: 100, ...query })
  return result.items.map((item) => item.cardCode).sort()
}

describe('o filtro de counter', () => {
  it('sem filtro, traz tudo', async () => {
    expect(await codigos({})).toEqual(['CT-001', 'CT-002', 'CT-003', 'CT-004', 'CT-005', 'CT-006'])
  })

  /*
   * O zero e personagem sem counter. Evento, Leader e Stage tambem nao tem
   * counter, mas nao por serem "counter 0": eles nao tem o atributo.
   */
  it('zero traz so personagem sem counter', async () => {
    expect(await codigos({ counter: [0] })).toEqual(['CT-003'])
  })

  it('+1000 e +2000 trazem o valor exato', async () => {
    expect(await codigos({ counter: [1000] })).toEqual(['CT-001'])
    expect(await codigos({ counter: [2000] })).toEqual(['CT-002'])
  })

  /* Dentro da faceta, os valores se somam por "ou", como nas outras. */
  it('varios valores se somam', async () => {
    expect(await codigos({ counter: [0, 2000] })).toEqual(['CT-002', 'CT-003'])
    expect(await codigos({ counter: [0, 1000, 2000] })).toEqual(['CT-001', 'CT-002', 'CT-003'])
  })

  /*
   * Entre facetas vale o "e". O filtro de counter vai num AND proprio, e nao
   * escreve por cima do tipo: Evento com counter devolve vazio, que e o que foi
   * pedido — as duas coisas juntas nao existem.
   */
  it('nao apaga o filtro de tipo', async () => {
    expect(await codigos({ counter: [0], type: ['Event'] })).toEqual([])
    expect(await codigos({ counter: [1000], type: ['Character'] })).toEqual(['CT-001'])
  })

  it('convive com a busca', async () => {
    expect(await codigos({ counter: [0, 1000], search: 'CT-001' })).toEqual(['CT-001'])
  })
})
