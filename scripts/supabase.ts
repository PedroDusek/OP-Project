import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/server/domain/storage/image'
import { importCatalog } from '@/server/application/catalog/import-catalog'
import { BandaiCatalogProvider } from '@/server/infrastructure/catalog/bandai-catalog-provider'
import { FileCatalogProvider } from '@/server/infrastructure/catalog/file-catalog-provider'
import { createPrisma } from '@/server/infrastructure/prisma'

/**
 * Operacoes contra o banco de producao no Supabase.
 *
 *   npm run supabase migrate           aplica as migrations pendentes
 *   npm run supabase import             importa o catalogo, baixando da fonte
 *   npm run supabase import 569117      importa apenas as series informadas
 *   npm run supabase import --from=DIR  importa de um snapshot local
 *   npm run supabase status             mostra o que existe la hoje
 *   npm run supabase storage            cria o bucket das imagens do usuario
 *
 * Prefira `--from` quando o snapshot ja existir: rebaixar o catalogo inteiro a
 * cada importacao e carga evitavel sobre a origem (decisao 020).
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

  // O bucket nao mora no banco: este comando nao precisa de SUPABASE_DATABASE_URL
  // e nao deve falhar por causa dela.
  if (command === 'storage') {
    await provisionBucket()
    return
  }

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
    const from = args.find((a) => a.startsWith('--from='))?.slice('--from='.length)

    const provider = from ? new FileCatalogProvider(from) : new BandaiCatalogProvider()
    console.log(
      from
        ? `[supabase] lendo do snapshot em ${from}`
        : '[supabase] baixando da fonte oficial',
    )

    const prisma = createPrisma(url)
    try {
      const report = await importCatalog(prisma, provider, {
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
      // Banco novo nao tem tabela nenhuma. Perguntar ao catalogo primeiro evita
      // quebrar no comando que todo mundo roda antes de qualquer outro.
      const [{ applied }] = await prisma.$queryRawUnsafe<{ applied: bigint }[]>(
        `SELECT count(*)::bigint AS applied
         FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = '_prisma_migrations'`,
      )
      if (Number(applied) === 0) {
        console.log('[supabase] banco vazio: nenhuma migration aplicada ainda.')
        console.log('[supabase] proximo passo: npm run supabase migrate')
        return
      }

      const migrations = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
        `SELECT migration_name FROM _prisma_migrations
         WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
         ORDER BY migration_name`,
      )
      const [cards, variants, sets, printings, users] = await Promise.all([
        prisma.card.count(),
        prisma.cardVariant.count(),
        prisma.set.count(),
        prisma.variantPrinting.count(),
        prisma.user.count(),
      ])
      console.log(`[supabase] migrations aplicadas: ${migrations.length}`)
      console.log(
        `[supabase] cards=${cards} variants=${variants} sets=${sets} ` +
          `printings=${printings} users=${users}`,
      )
    } finally {
      await prisma.$disconnect()
    }
    return
  }

  throw new Error(
    `Comando desconhecido: ${command ?? '(nenhum)'}. Use migrate, import, status ou storage.`,
  )
}

/**
 * Cria (ou ajusta) o bucket das imagens enviadas pelo usuario.
 *
 * Publico para leitura porque a foto vai num `<img>`: URL assinada expiraria no
 * meio de uma pagina aberta, e renova-la a cada render trocaria uma foto de
 * binder por um problema de cache.
 *
 * O limite de tamanho e a lista de tipos sao repetidos aqui **de proposito**.
 * O servidor ja recusa antes de subir um byte; isto e a segunda tranca, do lado
 * do Supabase, para o caso de alguem escrever por outro caminho. Os dois valores
 * saem da mesma constante do dominio, entao nao ha como divergirem.
 */
async function provisionBucket(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'colexa-imagens'

  if (!url || !secretKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY precisam estar definidas no .env.',
    )
  }

  console.log(`[supabase] bucket: ${bucket} em ${new URL(url).hostname}`)

  const storage = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage

  const options = {
    public: true,
    fileSizeLimit: MAX_IMAGE_BYTES,
    allowedMimeTypes: [...ACCEPTED_IMAGE_TYPES],
  }

  const created = await storage.createBucket(bucket, options)
  if (!created.error) {
    console.log('[supabase] bucket criado.')
    return
  }

  // Ja existir e o caso normal ao rodar de novo; qualquer outro erro e erro.
  const existing = await storage.getBucket(bucket)
  if (existing.error) throw new Error(created.error.message)

  const updated = await storage.updateBucket(bucket, options)
  if (updated.error) throw new Error(updated.error.message)
  console.log('[supabase] bucket ja existia; limites conferidos.')
}

main().catch((error: unknown) => {
  console.error('[supabase] falhou:', error instanceof Error ? error.message : error)
  process.exit(1)
})
