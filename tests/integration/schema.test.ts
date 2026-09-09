import { afterAll, describe, expect, it } from 'vitest'
import { disconnect, testPrisma } from '../helpers'

/**
 * Auditoria da estrutura aplicada.
 *
 * Estes testes olham o catalogo do PostgreSQL, nao o schema.prisma. O que
 * importa e o que existe no banco depois das migrations, porque parte da
 * integridade (CHECK, triggers, extensoes) nao passa pelo Prisma.
 */

/**
 * As 24 tabelas do modelo logico, mais as adicoes aprovadas.
 *
 * A lista e escrita a mao de proposito: tabela nova so entra aqui junto de uma
 * decisao que diz por que ela existe. Um teste que contasse as tabelas do banco
 * concordaria com qualquer coisa que alguem criasse.
 *
 * Fora do modelo logico:
 * - `exchange_rates` e `price_imports` (decisao 051).
 */
const EXPECTED_TABLES = [
  'attributes',
  'card_attributes',
  'card_colors',
  'card_effects',
  'card_mechanics',
  'card_prices',
  'card_traits',
  'card_variants',
  'cards',
  'collection_item_locations',
  'collection_items',
  'collections',
  'colors',
  'effects',
  'exchange_rates',
  'mechanics',
  'price_imports',
  'sets',
  'storage_locations',
  'trade_items',
  'trade_participants',
  'trades',
  'traits',
  'users',
  'variant_printings',
  'want_items',
]

/** A matriz de docs/database.md secao 4, como assercao executavel. */
const EXPECTED_DELETE_ACTIONS: Record<string, 'CASCADE' | 'RESTRICT'> = {
  'collections.user_id': 'CASCADE',
  'storage_locations.user_id': 'CASCADE',
  'want_items.user_id': 'CASCADE',
  'collection_items.collection_id': 'CASCADE',
  'collection_item_locations.collection_item_id': 'CASCADE',
  'collection_item_locations.storage_location_id': 'CASCADE',
  'variant_printings.card_variant_id': 'CASCADE',
  'card_colors.card_id': 'CASCADE',
  'card_traits.card_id': 'CASCADE',
  'card_attributes.card_id': 'CASCADE',
  'card_mechanics.card_id': 'CASCADE',
  'card_effects.card_id': 'CASCADE',
  'trade_participants.trade_id': 'CASCADE',
  'trade_items.trade_participant_id': 'CASCADE',

  'card_variants.card_id': 'RESTRICT',
  'variant_printings.set_id': 'RESTRICT',
  'collection_items.card_variant_id': 'RESTRICT',
  'want_items.card_variant_id': 'RESTRICT',
  'card_prices.card_variant_id': 'RESTRICT',
  'trade_items.card_variant_id': 'RESTRICT',
  'card_colors.color_id': 'RESTRICT',
  'card_traits.trait_id': 'RESTRICT',
  'card_attributes.attribute_id': 'RESTRICT',
  'card_mechanics.mechanic_id': 'RESTRICT',
  'card_effects.effect_id': 'RESTRICT',
  // Protege o historico de trade do participante que fica. Nunca dispara,
  // porque contas sao anonimizadas em vez de excluidas (decisao 015).
  'trade_participants.user_id': 'RESTRICT',
}

afterAll(async () => {
  await disconnect()
})

describe('estrutura do banco', () => {
  it('possui exatamente as tabelas do modelo logico e as aprovadas', async () => {
    const rows = await testPrisma().$queryRawUnsafe<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'
         AND table_name <> '_prisma_migrations'
       ORDER BY table_name`,
    )
    expect(rows.map((r) => r.table_name)).toEqual(EXPECTED_TABLES)
  })

  it('nao possui indice unico em (card_id, variant_type)', async () => {
    // Uma mesma carta tem varias alternate arts com o mesmo variant_type.
    // Um unique aqui rejeitaria catalogo valido. Ver docs/database.md 6.1.
    const rows = await testPrisma().$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'card_variants'`,
    )
    const offending = rows.filter(
      (r) =>
        r.indexdef.includes('UNIQUE') &&
        r.indexdef.includes('card_id') &&
        r.indexdef.includes('variant_type'),
    )
    expect(offending).toEqual([])
  })

  it('aplica a extensao pg_trgm e o indice GIN de busca por nome', async () => {
    const ext = await testPrisma().$queryRawUnsafe<{ extname: string }[]>(
      `SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`,
    )
    expect(ext).toHaveLength(1)

    const idx = await testPrisma().$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = 'cards_name_idx'`,
    )
    expect(idx).toHaveLength(1)
    expect(idx[0].indexdef).toContain('gin')
    expect(idx[0].indexdef).toContain('gin_trgm_ops')
  })

  it('mantem a busca exata por codigo em indice unico proprio', async () => {
    const idx = await testPrisma().$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = 'cards_code_key'`,
    )
    expect(idx).toHaveLength(1)
    expect(idx[0].indexdef).toContain('UNIQUE')
  })

  it('cria os tres triggers de integridade', async () => {
    const rows = await testPrisma().$queryRawUnsafe<{ tgname: string }[]>(
      `SELECT t.tgname FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       WHERE NOT t.tgisinternal
         AND c.relnamespace = 'public'::regnamespace
       ORDER BY t.tgname`,
    )
    expect(rows.map((r) => r.tgname)).toEqual([
      'collection_item_locations_same_owner',
      'collection_item_locations_within_owned_quantity',
      'collection_items_quantity_covers_allocations',
    ])
  })

  it('aplica a politica de exclusao exatamente como documentada', async () => {
    const rows = await testPrisma().$queryRawUnsafe<
      { relation: string; action: string }[]
    >(
      `SELECT c.relname || '.' || a.attname AS relation,
              CASE con.confdeltype
                WHEN 'a' THEN 'NO ACTION'
                WHEN 'r' THEN 'RESTRICT'
                WHEN 'c' THEN 'CASCADE'
                WHEN 'n' THEN 'SET NULL'
                WHEN 'd' THEN 'SET DEFAULT'
              END AS action
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
       JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
       WHERE con.contype = 'f'
         AND con.connamespace = 'public'::regnamespace
       ORDER BY relation`,
    )

    const actual = Object.fromEntries(rows.map((r) => [r.relation, r.action]))
    expect(actual).toEqual(EXPECTED_DELETE_ACTIONS)
  })
})
