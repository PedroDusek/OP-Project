import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import { importCatalog } from '@/server/application/catalog/import-catalog'
import { BandaiCatalogProvider } from '@/server/infrastructure/catalog/bandai-catalog-provider'
import { createPrisma } from '@/server/infrastructure/prisma'

/**
 * Operacoes contra o banco de producao no Supabase.
 *
 *   npm run supabase migrate           aplica as migrations pendentes
 *   npm run supabase import            importa o catalogo completo
 *   npm run supabase import 569117     importa apenas as series informadas
 *   npm run supabase status            mostra o que existe la hoje
 *
 * Producao nunca e o alvo padrao. `DATABASE_URL` continua apontando para o
 * banco local em todo o resto do projeto; so este script usa
 * SUPABASE_DATABASE_URL, e so quando chamado de proposito. Nao existe
 * `db:reset` aqui: derrubar producao nao deve ser um comando a um passo de
 * distancia.
 */

function target(): { url: string; host: string; database: string } {
  const url = process.env.SUPABASE_DATABASE_URL
  if (!url) {
    throw new Error(
      'SUPABASE_DATABASE_URL nao esta definida. Cole a connection string do Supabase no .env.',
    )
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('SUPABASE_DATABASE_URL nao e uma URL valida.')
  }

  // Se apontar para a maquina local, algo foi colado no lugar errado. Melhor
  // falhar do que aplicar em producao o que era para ser local, ou o contrario.
  if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
    throw new Error(
      `SUPABASE_DATABASE_URL aponta para ${parsed.hostname}. Isso e o banco local, nao o Supabase.`,
    )
  }
  if (url === process.env.DATABASE_URL) {
    throw new Error('SUPABASE_DATABASE_URL e igual a DATABASE_URL. Elas precisam ser bancos diferentes.')
  }

  return {
    url,
    host: parsed.hostname,
    database: parsed.pathname.replace(/^\//, '') || 'postgres',
  }
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)
  const { url, host, database } = target()

  // Sempre diz em voz alta onde vai mexer, sem nunca imprimir a senha.
  console.log(`[supabase] alvo: ${database} em ${host}`)

  if (command === 'migrate') {
    console.log('[supabase] aplicando migrations...')
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'inherit',
      shell: true,
    })
    return
  }

  if (command === 'import') {
    const seriesIds = args.filter((a) => /^\d+$/.test(a))
    const prisma = createPrisma(url)
    try {
      const report = await importCatalog(prisma, new BandaiCatalogProvider(), {
        seriesIds: seriesIds.length > 0 ? seriesIds : undefined,
      })
      if (report.seriesFailed > 0) process.exitCode = 1
    } finally {
      await prisma.$disconnect()
    }
    return
  }

  if (command === 'status') {
    const prisma = createPrisma(url)
    try {
      const [cards, variants, sets, printings, users] = await Promise.all([
        prisma.card.count(),
        prisma.cardVariant.count(),
        prisma.set.count(),
        prisma.variantPrinting.count(),
        prisma.user.count(),
      ])
      console.log(
        `[supabase] cards=${cards} variants=${variants} sets=${sets} ` +
          `printings=${printings} users=${users}`,
      )
    } finally {
      await prisma.$disconnect()
    }
    return
  }

  throw new Error(`Comando desconhecido: ${command ?? '(nenhum)'}. Use migrate, import ou status.`)
}

main().catch((error: unknown) => {
  console.error('[supabase] falhou:', error instanceof Error ? error.message : error)
  process.exit(1)
})
