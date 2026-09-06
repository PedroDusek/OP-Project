import 'dotenv/config'
import { importCatalog } from '@/server/application/catalog/import-catalog'
import { BandaiCatalogProvider } from '@/server/infrastructure/catalog/bandai-catalog-provider'
import { createPrisma } from '@/server/infrastructure/prisma'

/**
 * Importacao do catalogo, executada sob demanda.
 *
 *   npm run catalog:import              todas as series
 *   npm run catalog:import -- 569117    apenas as series informadas
 *
 * Nunca roda a cada requisicao de usuario: depois da importacao, o banco
 * interno e a fonte operacional (decisao 020).
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL nao esta definida.')

  const seriesIds = process.argv.slice(2).filter((arg) => /^\d+$/.test(arg))
  const prisma = createPrisma(url)
  const provider = new BandaiCatalogProvider()

  try {
    const report = await importCatalog(prisma, provider, {
      seriesIds: seriesIds.length > 0 ? seriesIds : undefined,
    })

    if (report.rejected.length > 0) {
      console.warn(`[import] ${report.rejected.length} entradas rejeitadas:`)
      for (const entry of report.rejected.slice(0, 20)) {
        console.warn(`   ${entry.sourceId ?? '(sem id)'}: ${entry.reason}`)
      }
    }

    // Falha visivel no codigo de saida: uma serie perdida nao pode passar por
    // sucesso numa execucao agendada.
    if (report.seriesFailed > 0) process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('[import] falhou:', error)
  process.exit(1)
})
