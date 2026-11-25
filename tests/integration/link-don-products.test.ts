import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { linkDonProducts } from '@/server/application/catalog/link-don-products'
import { createCard, disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * O vínculo com o produto do TCGplayer para as cartas de código **nosso**.
 *
 * Duas famílias, pelo mesmo motivo: elas não têm número na origem, o código
 * delas é inventado por nós, e o `source_id` da arte **é** o `productId`. A
 * dedução normal (`linkArtProducts`) casa pelo código da Bandai e não serve.
 *
 * - DON!! (decisão 112), que entram pelo **tipo**.
 * - Líderes de evento selado (decisão 115), que entram pela **lista de ids**.
 *
 * Sem este vínculo a carta fica sem preço para sempre.
 */

async function arte(code: string, type: 'DON' | 'Leader', sourceId: string) {
  const db = testPrisma()
  const card = await db.card.create({ data: { code, name: `Carta ${code}`, type } })
  return db.cardVariant.create({
    data: { cardId: card.id, variantType: 'Normal', sourceId },
  })
}

async function produtosLigados(): Promise<string[]> {
  const linhas = await testPrisma().variantSourceProduct.findMany({
    select: { sourceProductId: true },
  })
  return linhas.map((linha) => linha.sourceProductId).sort()
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('quem ganha vínculo', () => {
  it('o DON!!, pelo tipo', async () => {
    await arte('DON-482236', 'DON', '482236')

    const resultado = await linkDonProducts(testPrisma())

    expect(resultado).toMatchObject({ variants: 1, created: 1 })
    expect(await produtosLigados()).toEqual(['482236'])
  })

  it('o líder de evento selado, pelo id escolhido', async () => {
    await arte('SB-712746', 'Leader', '712746')

    const resultado = await linkDonProducts(testPrisma())

    expect(resultado).toMatchObject({ variants: 1, created: 1 })
    expect(await produtosLigados()).toEqual(['712746'])
  })

  /**
   * **A armadilha que este teste existe para pegar.**
   *
   * O líder selado é `Leader`, como 149 cartas da Bandai. Se o seletor casasse
   * por tipo — que é como o DON!! entra —, cada uma delas ganharia um vínculo
   * com um "productId" que na verdade é o código da carta, e o preço de todas
   * passaria a procurar um produto que não existe.
   */
  it('um líder comum da Bandai não ganha, mesmo tendo source_id', async () => {
    await arte('OP01-003', 'Leader', 'OP01-003')

    const resultado = await linkDonProducts(testPrisma())

    expect(resultado).toMatchObject({ variants: 0, created: 0 })
    expect(await produtosLigados()).toEqual([])
  })

  it('uma carta comum também não', async () => {
    const db = testPrisma()
    const card = await createCard('Character', 'OP01-001')
    await db.cardVariant.create({
      data: { cardId: card.id, variantType: 'Normal', sourceId: 'OP01-001' },
    })

    expect(await linkDonProducts(db)).toMatchObject({ variants: 0, created: 0 })
  })
})

describe('rodar de novo', () => {
  it('não duplica nada', async () => {
    await arte('DON-482236', 'DON', '482236')
    await arte('SB-712746', 'Leader', '712746')

    const primeira = await linkDonProducts(testPrisma())
    const segunda = await linkDonProducts(testPrisma())

    expect(primeira).toMatchObject({ variants: 2, created: 2, updated: 0 })
    expect(segunda).toMatchObject({ variants: 2, created: 0, updated: 0 })
    expect(await produtosLigados()).toEqual(['482236', '712746'])
  })

  /*
   * `origin: 'automatic'`, e nao `manual`: ninguem conferiu nada a mao, e
   * `manual` e intocavel pela deducao (decisao 074) — marcar assim protegeria
   * estes de uma correcao futura sem ninguem ter decidido isso.
   */
  it('marca como automático', async () => {
    await arte('SB-712746', 'Leader', '712746')
    await linkDonProducts(testPrisma())

    const vinculo = await testPrisma().variantSourceProduct.findFirst({
      select: { origin: true, source: true },
    })

    expect(vinculo).toMatchObject({ origin: 'automatic', source: 'tcgcsv' })
  })
})
