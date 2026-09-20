import 'dotenv/config'
import { createPrisma } from '@/server/infrastructure/prisma'

/**
 * Os índices que existem, e o plano das consultas que mais pesam.
 *
 * Diagnóstico, não rotina. Roda contra o banco **local**: o plano depende do
 * tamanho das tabelas, e catálogo e preços aqui têm o mesmo tamanho de
 * produção, que é o que importa nas consultas abaixo.
 */

async function main(): Promise<void> {
  const prisma = createPrisma(process.env.DATABASE_URL!, { max: 2 })

  const indices = await prisma.$queryRawUnsafe<{ tabela: string; indice: string; def: string }[]>(`
    SELECT tablename AS tabela, indexname AS indice, indexdef AS def
      FROM pg_indexes
     WHERE schemaname = 'public'
     ORDER BY tablename, indexname
  `)
  const porTabela = new Map<string, string[]>()
  for (const linha of indices) {
    porTabela.set(linha.tabela, [...(porTabela.get(linha.tabela) ?? []), linha.indice])
  }
  console.log('índices por tabela:')
  for (const [tabela, lista] of porTabela) console.log(`  ${tabela.padEnd(26)} ${lista.length}`)

  const consultas: [string, string][] = [
    [
      'preço mais recente de cada variante (dashboard e deck)',
      `SELECT DISTINCT ON (card_variant_id) card_variant_id, value
         FROM card_prices ORDER BY card_variant_id, captured_at DESC`,
    ],
    [
      'catálogo inteiro com cores e impressões (dashboard)',
      `SELECT v.id, v.rarity, c.code FROM card_variants v JOIN cards c ON c.id = v.card_id`,
    ],
    [
      'quem tem carta em local de troca (Social)',
      `SELECT DISTINCT sl.user_id
         FROM collection_item_locations cil
         JOIN storage_locations sl ON sl.id = cil.storage_location_id
        WHERE sl.purpose = 'TRADE' AND cil.quantity > 0`,
    ],
  ]

  console.log('\nplano das consultas pesadas:')
  for (const [nome, sql] of consultas) {
    const plano = await prisma.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`,
    )
    const linhas = plano.map((p) => p['QUERY PLAN'])
    const tempo = linhas.find((l) => l.startsWith('Execution Time'))
    const varre = linhas.filter((l) => /Seq Scan/.test(l)).length
    console.log(`  ${nome}`)
    console.log(`    ${tempo?.trim() ?? '?'} | varreduras sequenciais: ${varre}`)
    console.log(`    ${linhas[0].trim().slice(0, 120)}`)
  }

  await prisma.$disconnect()
}

main().catch((erro: unknown) => {
  console.error(erro)
  process.exit(1)
})
