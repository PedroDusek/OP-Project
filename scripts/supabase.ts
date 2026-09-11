import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { provisionImageBucket } from '@/server/infrastructure/storage/supabase-image-storage'
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
 *   npm run supabase prices             importa precos de arte comum e cambio
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

/** As migrations do repositorio, para comparar com o que esta aplicado la. */
const MIGRATIONS_DIR = fileURLToPath(new URL('../prisma/migrations', import.meta.url))

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

  if (command === 'prices') {
    const prisma = createPrisma(url)
    try {
      const { importPrices } = await import('@/server/application/prices/import-prices')
      const { importExchangeRate } = await import(
        '@/server/application/prices/import-exchange-rate'
      )
      const { linkArtProducts } = await import(
        '@/server/application/prices/link-art-products'
      )
      const { TcgCsvPriceProvider } = await import(
        '@/server/infrastructure/prices/tcgcsv-price-provider'
      )
      const { oncePerRun } = await import('@/server/infrastructure/prices/once-per-run')
      const { loadManualLinks } = await import(
        '@/server/infrastructure/prices/manual-links-file'
      )
      const { BcbPtaxProvider } = await import(
        '@/server/infrastructure/prices/bcb-ptax-provider'
      )

      // Cambio primeiro, e sem poder derrubar os precos: sem cotacao a tela
      // mostra so o dolar, o que e bem melhor que nao mostrar preco nenhum.
      const rate = await importExchangeRate(prisma, new BcbPtaxProvider()).catch(
        (error: unknown) => {
          console.warn(
            '[supabase] cambio falhou, seguindo sem atualizar:',
            error instanceof Error ? error.message : error,
          )
          return null
        },
      )
      if (rate) console.log(`[supabase] cambio: USD/BRL ${rate.rate}`)

      // O vinculo antes do preco, para um vinculo novo ja render preco na
      // mesma passada. `oncePerRun` faz os dois lerem a fonte uma vez so.
      const provider = oncePerRun(new TcgCsvPriceProvider())
      // O arquivo manual e o que leva o trabalho do dono do produto a producao
      // (decisao 068). Invalido, ele para a importacao antes de tocar no banco.
      await linkArtProducts(prisma, provider, { manualLinks: loadManualLinks() })

      const result = await importPrices(prisma, provider)
      console.log(
        `[supabase] precos: fonte ${result.fetched} | casados ${result.matched} | ` +
          `gravados ${result.written} | sem mudanca ${result.unchanged} | ` +
          `por vinculo ${result.linkedPriced}`,
      )
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

      /*
       * O estado dos precos, que e o unico que muda sozinho.
       *
       * Catalogo so muda quando alguem manda importar; preco muda todo dia, por
       * agendamento. Entao e aqui que se ve se o agendamento esta vivo — e o
       * modo de falha e silencioso: a tela nao quebra sem preco novo, so para
       * de envelhecer sem ninguem perceber.
       */
      const [ultimaImportacao, cotacao, variantesComPreco] = await Promise.all([
        prisma.priceImport.findFirst({
          where: { finishedAt: { not: null }, failure: null },
          orderBy: { finishedAt: 'desc' },
          select: { finishedAt: true, matched: true, written: true },
        }),
        prisma.exchangeRate.findFirst({
          where: { baseCurrency: 'USD', quoteCurrency: 'BRL' },
          orderBy: { quoteDate: 'desc' },
          select: { rate: true, quoteDate: true },
        }),
        prisma.cardPrice
          .findMany({ distinct: ['cardVariantId'], select: { cardVariantId: true } })
          .then((rows) => rows.length),
      ])
      /*
       * Comparar com o repositorio, e nao so contar.
       *
       * Producao ficou duas migrations atras sem ninguem notar, porque o numero
       * sozinho nao diz nada: "5" so vira problema quando alguem conta as
       * pastas a mao. E o preco de nao notar e alto — publicar codigo que usa
       * uma tabela ausente derruba a tela inteira, e nao so a parte nova.
       */
      const noRepositorio = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
      const aplicadas = new Set(migrations.map((m) => m.migration_name))
      const faltando = noRepositorio.filter((name) => !aplicadas.has(name))

      console.log(
        `[supabase] migrations: ${migrations.length} de ${noRepositorio.length} aplicadas`,
      )
      if (faltando.length > 0) {
        console.log(`[supabase] FALTAM ${faltando.length}: ${faltando.join(', ')}`)
        console.log('[supabase] rode: npm run supabase migrate')
      }
      if (ultimaImportacao?.finishedAt) {
        console.log(
          `[supabase] precos: ${variantesComPreco} variantes | ultima importacao ` +
            `${ultimaImportacao.finishedAt.toISOString()} ` +
            `(casados ${ultimaImportacao.matched}, gravados ${ultimaImportacao.written})`,
        )
      } else {
        console.log('[supabase] precos: nenhuma importacao concluida ainda.')
      }
      if (cotacao) {
        console.log(
          `[supabase] cambio: USD/BRL ${cotacao.rate} em ` +
            `${cotacao.quoteDate.toISOString().slice(0, 10)}`,
        )
      }

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
    `Comando desconhecido: ${command ?? '(nenhum)'}. ` +
      'Use migrate, import, prices, status ou storage.',
  )
}

/**
 * Cria (ou confere) o bucket das imagens enviadas pelo usuario.
 *
 * A conversa com o Supabase mora em `SupabaseImageStorage`, junto com o upload:
 * um lugar so sabe a forma da API de Storage, e o script apenas relata.
 */
async function provisionBucket(): Promise<void> {
  const { outcome, bucket, host } = await provisionImageBucket()
  console.log(`[supabase] bucket: ${bucket} em ${host}`)
  console.log(
    outcome === 'created'
      ? '[supabase] bucket criado.'
      : '[supabase] bucket ja existia; limites conferidos.',
  )
}

main().catch((error: unknown) => {
  console.error('[supabase] falhou:', error instanceof Error ? error.message : error)
  process.exit(1)
})
