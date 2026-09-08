import 'dotenv/config'
import { importPrices } from '@/server/application/prices/import-prices'
import { TcgCsvPriceProvider } from '@/server/infrastructure/prices/tcgcsv-price-provider'
import { createPrisma } from '@/server/infrastructure/prisma'

/**
 * Importa os precos de arte comum para o banco **local**.
 *
 *   npm run prices:import
 *
 * Producao e alvo explicito, como sempre: `npm run supabase prices`.
 *
 * Roda sob demanda ou por agendamento, nunca por requisicao de usuario. A fonte
 * publica um arquivo por dia; rodar mais de uma vez no mesmo dia nao acrescenta
 * linha nenhuma, porque so o que muda e gravado.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL nao esta definida.')

  const prisma = createPrisma(url)
  try {
    const result = await importPrices(prisma, new TcgCsvPriceProvider())
    console.log(
      `[precos] fonte ${result.fetched} | casados ${result.matched} | ` +
        `gravados ${result.written} | sem mudanca ${result.unchanged} | ` +
        `codigo desconhecido ${result.unknownCodes}`,
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('[precos] falhou:', error instanceof Error ? error.message : error)
  process.exit(1)
})
