import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { AuthenticatedUser } from '@/server/application/auth'
import { markExchange } from '@/server/application/trades/complete-trade'
import { confirmTrade } from '@/server/application/trades/edit-offer'
import {
  allocate,
  createCardWithVariant,
  createStorage,
  createUser,
  disconnect,
  own,
  resetDatabase,
  testPrisma,
} from '../helpers'

/**
 * Uma troca grande, de ponta a ponta (revisão de gargalos, 20/09).
 *
 * A conclusão grava carta a carta dentro de uma transação: tira do local de
 * troca e mexe na coleção dos dois lados. É o mesmo formato que estourou o
 * prazo na leva de 131 cartas (armadilha 74), e aqui **não há teto** de cartas
 * por troca.
 *
 * Este teste existe para o dia em que alguém trocar um binder inteiro. Ele não
 * mede tempo — na máquina de quem desenvolve o banco responde em microssegundos
 * —, mas garante que a troca inteira se aplica numa transação só e deixa os
 * dois lados certos.
 */

const CARTAS_POR_LADO = 60

async function pessoa(nome: string): Promise<AuthenticatedUser & { collectionId: bigint }> {
  const criada = await createUser(nome)
  return {
    id: criada.id,
    email: criada.email,
    name: nome,
    plan: 'PREMIUM',
    premiumUntil: new Date('2046-01-01'),
    collectionId: criada.collection!.id,
  }
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('troca grande', () => {
  it('conclui uma troca de 60 cartas de cada lado, numa transação só', async () => {
    const ana = await pessoa('Ana')
    const bia = await pessoa('Bia')
    const binderDaAna = await createStorage(ana.id, 'BINDER', 'TRADE', 'Troca da Ana')
    const binderDaBia = await createStorage(bia.id, 'BINDER', 'TRADE', 'Troca da Bia')

    const trade = await testPrisma().trade.create({
      data: {
        status: 'NEGOTIATING',
        participants: {
          create: [
            { userId: ana.id, role: 'INITIATOR' },
            { userId: bia.id, role: 'RECIPIENT' },
          ],
        },
      },
      include: { participants: true },
    })
    const participanteDaAna = trade.participants.find((p) => p.userId === ana.id)!
    const participanteDaBia = trade.participants.find((p) => p.userId === bia.id)!

    for (let i = 0; i < CARTAS_POR_LADO; i++) {
      const { variant } = await createCardWithVariant('Character', `TR${String(i).padStart(3, '0')}`)
      const daAna = await own(ana.collectionId, variant.id, 2)
      await allocate(daAna.id, binderDaAna.id, 2)
      await testPrisma().tradeItem.create({
        data: { tradeParticipantId: participanteDaAna.id, cardVariantId: variant.id, quantity: 1 },
      })

      const outra = await createCardWithVariant('Character', `TB${String(i).padStart(3, '0')}`)
      const daBia = await own(bia.collectionId, outra.variant.id, 2)
      await allocate(daBia.id, binderDaBia.id, 2)
      await testPrisma().tradeItem.create({
        data: { tradeParticipantId: participanteDaBia.id, cardVariantId: outra.variant.id, quantity: 1 },
      })
    }

    // Confirmar exige que a oferta não tenha mudado nos últimos 5 s (decisão 065).
    await testPrisma().trade.update({
      where: { id: trade.id },
      data: { offerChangedAt: new Date(Date.now() - 60_000) },
    })
    await confirmTrade(testPrisma(), ana, trade.id)
    await confirmTrade(testPrisma(), bia, trade.id)

    await markExchange(testPrisma(), ana, trade.id)
    const fim = await markExchange(testPrisma(), bia, trade.id)

    expect(fim.completed).toBe(true)
    const depois = await testPrisma().trade.findUniqueOrThrow({ where: { id: trade.id } })
    expect(depois.status).toBe('COMPLETED')

    // Cada lado deu 60 cópias e recebeu 60: a coleção continua com 60 linhas de
    // duas cópias (o que ficou) mais 60 linhas de uma (o que chegou).
    const itensDaAna = await testPrisma().collectionItem.count({
      where: { collection: { userId: ana.id } },
    })
    expect(itensDaAna).toBe(CARTAS_POR_LADO * 2)
  })
})
