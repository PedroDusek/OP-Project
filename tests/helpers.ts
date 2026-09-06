import 'dotenv/config'
import type { PrismaClient } from '@prisma/client'
import { createPrisma } from '@/server/infrastructure/prisma'

/**
 * Ordem inversa de dependencia. TRUNCATE ... CASCADE dispensaria a ordem, mas
 * lista-la explicitamente documenta o grafo e faz o teste falhar se alguem
 * acrescentar uma tabela sem pensar na limpeza.
 */
const TABLES_IN_TRUNCATION_ORDER = [
  'trade_items',
  'trade_participants',
  'trades',
  'card_prices',
  'collection_item_locations',
  'collection_items',
  'want_items',
  'storage_locations',
  'collections',
  'users',
  'variant_printings',
  'card_colors',
  'card_traits',
  'card_attributes',
  'card_mechanics',
  'card_effects',
  'card_variants',
  'cards',
  'sets',
  'colors',
  'traits',
  'attributes',
  'mechanics',
  'effects',
] as const

let client: PrismaClient | undefined

export function testPrisma(): PrismaClient {
  if (!client) {
    const url = process.env.TEST_DATABASE_URL
    if (!url) throw new Error('TEST_DATABASE_URL nao esta definida.')
    client = createPrisma(url)
  }
  return client
}

export async function resetDatabase(): Promise<void> {
  const db = testPrisma()
  const list = TABLES_IN_TRUNCATION_ORDER.map((t) => `"${t}"`).join(', ')
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
}

export async function disconnect(): Promise<void> {
  if (client) {
    await client.$disconnect()
    client = undefined
  }
}

// --------------------------------------------------------------- fixtures

let sequence = 0
function nextSuffix(): string {
  sequence += 1
  return `${Date.now().toString(36)}${sequence}`
}

export async function createUser(name = 'Usuario de teste') {
  const db = testPrisma()
  return db.user.create({
    data: {
      name,
      email: `teste-${nextSuffix()}@example.test`,
      collection: { create: { name: 'Minha Colecao' } },
    },
    include: { collection: true },
  })
}

export async function createCard(
  type: 'Leader' | 'Character' | 'Event' | 'Stage' = 'Character',
  code?: string,
) {
  const db = testPrisma()
  return db.card.create({
    data: {
      code: code ?? `OP01-${nextSuffix()}`.slice(0, 20),
      name: 'Carta de teste',
      type,
    },
  })
}

export async function createVariant(cardId: bigint, variantType = 'Normal') {
  const db = testPrisma()
  return db.cardVariant.create({ data: { cardId, variantType } })
}

/** Cria uma carta com uma variante Normal, o caso mais comum nos testes. */
export async function createCardWithVariant(
  type: 'Leader' | 'Character' | 'Event' | 'Stage' = 'Character',
) {
  const card = await createCard(type)
  const variant = await createVariant(card.id)
  return { card, variant }
}

export async function createStorage(
  userId: bigint,
  type: 'BINDER' | 'BOX' | 'DECK',
  purpose: 'COLLECTION' | 'TRADE' | null,
  name = 'Armazenamento de teste',
) {
  const db = testPrisma()
  return db.storageLocation.create({ data: { userId, type, purpose, name } })
}

export async function own(
  collectionId: bigint,
  cardVariantId: bigint,
  quantity: number,
) {
  const db = testPrisma()
  return db.collectionItem.create({
    data: { collectionId, cardVariantId, quantity },
  })
}

export async function allocate(
  collectionItemId: bigint,
  storageLocationId: bigint,
  quantity: number,
) {
  const db = testPrisma()
  return db.collectionItemLocation.create({
    data: { collectionItemId, storageLocationId, quantity },
  })
}

/**
 * Limpa apenas os dados de usuario, preservando o catalogo.
 *
 * Os testes de API importam o catalogo uma vez, porque e caro, mas cada teste
 * precisa comecar sem usuario: sem isto, um teste que anonimiza a conta deixa
 * todos os seguintes recebendo 401.
 */
export async function resetUserData(): Promise<void> {
  const db = testPrisma()
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE "trade_items", "trade_participants", "trades",
       "collection_item_locations", "collection_items", "want_items",
       "storage_locations", "collections", "users"
     RESTART IDENTITY CASCADE`,
  )
}
