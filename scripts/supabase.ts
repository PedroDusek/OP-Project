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
 * Conexoes de cada comando de producao. O Session pooler do Supabase aceita 15
 * clientes ao todo, e o site ja usa ate 8 (`APP_POOL_MAX`): a tarefa de precos
 * rodando junto com gente navegando nao pode passar do total (19/09).
 */
const POOL_MAX = 4

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
 *   npm run supabase contas             anonimiza as contas com exclusao vencida
 *   npm run supabase premium <email> --ate=2026-12-31   da Premium ate a data
 *   npm run supabase aquecer            pede as imagens das cartas mais vistas
 *   npm run supabase premium <email> --remover          volta a conta para Free
 *   npm run supabase limpar-contas      mostra as contas que existem, sem apagar
 *   npm run supabase limpar-contas --confirmar   apaga todas as contas
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

    const prisma = createPrisma(url, { max: POOL_MAX })
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
    const prisma = createPrisma(url, { max: POOL_MAX })
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
      const { loadLigaCards } = await import('@/server/infrastructure/catalog/liga-cards-file')
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
      // A tabela da Liga vai junto: o tratamento conferido nela vincula a arte ao
      // produto (decisao 072), e e o que leva esse vinculo a producao.
      await linkArtProducts(prisma, provider, {
        manualLinks: loadManualLinks(),
        ligaCards: loadLigaCards(),
      })

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

  if (command === 'aquecer') {
    /*
     * Pre-aquecimento das imagens (decisao 094).
     *
     * Quem ve uma carta pela primeira vez espera a ida ate o servidor da Bandai,
     * no Japao: ~3 s por imagem de ate 2,2 MB. Depois disso a versao leve fica no
     * volume da Fly (decisao 090) e sai em 0,1 s. Este comando paga essa primeira
     * vez por nos, na ordem em que as cartas realmente aparecem.
     *
     * Poucas em paralelo de proposito: a fonte e de terceiro, e a decisao 020
     * pede cortesia com ela.
     */
    const site = (args.find((a) => a.startsWith('--url='))?.slice('--url='.length) ?? process.env.APP_URL ?? 'https://colexa.fly.dev').trim()
    const limite = Number(args.find((a) => a.startsWith('--limite='))?.slice('--limite='.length) ?? 200)
    const paralelas = Number(args.find((a) => a.startsWith('--paralelas='))?.slice('--paralelas='.length) ?? 3)
    if (!Number.isFinite(limite) || limite < 1) throw new Error('--limite precisa ser um numero maior que zero.')
    if (!Number.isFinite(paralelas) || paralelas < 1 || paralelas > 6) {
      throw new Error('--paralelas precisa ficar entre 1 e 6: a fonte e de terceiro.')
    }

    const { optimizedImageUrl, WARMUP_WIDTHS } = await import('@/server/domain/catalog/optimized-image')

    const prisma = createPrisma(url, { max: POOL_MAX })
    try {
      /*
       * A ordem e o que faz caber num numero pequeno: primeiro o que esta em
       * local de troca (aparece na Social e nas trocas), depois o que alguem
       * possui, e so entao o resto — do mais novo para o mais antigo, que e a
       * ordem em que o catalogo foi importado.
       */
      const variantes = await prisma.$queryRaw<{ image_url: string }[]>`
        SELECT v.image_url
          FROM card_variants v
         WHERE v.image_url IS NOT NULL
         ORDER BY EXISTS (
                   SELECT 1 FROM collection_item_locations cil
                     JOIN collection_items ci ON ci.id = cil.collection_item_id
                     JOIN storage_locations sl ON sl.id = cil.storage_location_id
                    WHERE ci.card_variant_id = v.id AND sl.purpose = 'TRADE' AND cil.quantity > 0
                 ) DESC,
                 EXISTS (
                   SELECT 1 FROM collection_items ci
                    WHERE ci.card_variant_id = v.id AND ci.quantity > 0
                 ) DESC,
                 v.id DESC
         LIMIT ${limite}
      `

      const pedidos = variantes.flatMap((v) => WARMUP_WIDTHS.map((w) => optimizedImageUrl(site, v.image_url, w)))
      console.log(`[supabase] aquecer: ${variantes.length} cartas, ${pedidos.length} imagens, ${paralelas} por vez em ${site}`)

      let ok = 0
      let falhas = 0
      let jaProntas = 0
      const inicio = Date.now()

      const fila = [...pedidos]
      const trabalhar = async () => {
        for (let proximo = fila.pop(); proximo; proximo = fila.pop()) {
          const comecou = Date.now()
          try {
            const resposta = await fetch(proximo, {
              headers: { accept: 'image/webp,image/avif,image/*' },
              signal: AbortSignal.timeout(60_000),
            })
            // O corpo precisa ser lido: sem isso a conexao fica pendurada.
            await resposta.arrayBuffer()
            if (resposta.ok) {
              ok++
              // Resposta instantanea e imagem que ja estava pronta no volume.
              if (Date.now() - comecou < 500) jaProntas++
            } else {
              falhas++
            }
          } catch {
            falhas++
          }
        }
      }

      await Promise.all(Array.from({ length: paralelas }, () => trabalhar()))

      const segundos = Math.round((Date.now() - inicio) / 1000)
      console.log(
        `[supabase] aquecer: ${ok} prontas (${jaProntas} ja estavam), ${falhas} com falha, em ${segundos}s`,
      )
      // Falha de imagem nao derruba nada: a proxima pessoa que abrir a carta
      // paga a espera, como pagava antes deste comando existir.
    } finally {
      await prisma.$disconnect()
    }
    return
  }

  if (command === 'premium') {
    // Decisao 093: a cortesia dos testadores, enquanto nao existe pagamento.
    // Por e-mail, porque e o que o dono do produto tem em maos; nunca por id.
    const email = args.find((a) => !a.startsWith('--'))?.trim().toLowerCase()
    const remover = args.includes('--remover')
    const ate = args.find((a) => a.startsWith('--ate='))?.slice('--ate='.length)

    if (!email) throw new Error('Informe o e-mail: npm run supabase premium <email> --ate=AAAA-MM-DD')
    if (!remover && !ate) {
      throw new Error(
        'Informe o prazo (--ate=AAAA-MM-DD) ou use --remover. Premium sem prazo nao cai sozinho no fim do beta.',
      )
    }

    let premiumUntil: Date | null = null
    if (!remover) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ate!)) throw new Error('Data invalida. Use --ate=AAAA-MM-DD.')
      // Fim do dia informado, em Brasilia: quem recebe "ate 31/12" espera ter o
      // dia 31 inteiro, e nao perder o acesso a meia-noite UTC.
      premiumUntil = new Date(`${ate}T23:59:59-03:00`)
      if (Number.isNaN(premiumUntil.getTime())) throw new Error('Data invalida. Use --ate=AAAA-MM-DD.')
      if (premiumUntil <= new Date()) throw new Error('A data ja passou.')
    }

    const prisma = createPrisma(url, { max: POOL_MAX })
    try {
      const { count } = await prisma.user.updateMany({
        where: { email, deletedAt: null },
        data: remover
          ? { plan: 'FREE', premiumUntil: null }
          : { plan: 'PREMIUM', premiumUntil },
      })
      if (count === 0) {
        console.log('[supabase] premium: nenhuma conta com esse e-mail (ou conta excluida).')
        process.exitCode = 1
        return
      }
      console.log(
        remover
          ? '[supabase] premium: conta de volta ao Free.'
          : `[supabase] premium: Premium ate ${premiumUntil!.toISOString()}.`,
      )
    } finally {
      await prisma.$disconnect()
    }
    return
  }

  if (command === 'contas') {
    // Decisao 091: quem pediu para excluir a conta ha mais de 30 dias. Precisa
    // da chave secreta, porque exclui a conta no Supabase Auth tambem.
    const prisma = createPrisma(url, { max: POOL_MAX })
    try {
      const { anonymizeDueAccounts } = await import('@/server/application/account/delete-account')
      const { SupabaseAuthAdmin } = await import('@/server/infrastructure/auth/supabase-auth-admin')
      const { SupabaseImageStorage } = await import('@/server/infrastructure/storage/supabase-image-storage')

      const report = await anonymizeDueAccounts(prisma, {
        authAdmin: new SupabaseAuthAdmin(),
        images: new SupabaseImageStorage(),
      })
      // So numeros: nenhum nome nem e-mail no log de uma tarefa agendada.
      console.log(
        `[supabase] contas: ${report.due} vencida(s), ${report.anonymized} anonimizada(s), ${report.failed} com falha`,
      )
      if (report.failed > 0) process.exitCode = 1
    } finally {
      await prisma.$disconnect()
    }
    return
  }

  if (command === 'limpar-contas') {
    /*
     * Zera os usuarios (pedido do dono do produto em 19/09). Sem `--confirmar`
     * so mostra o que seria apagado. Apagar nao tem volta e nao tem backup no
     * plano gratuito: por isso o levantamento vem sempre primeiro, e quem roda
     * com `--confirmar` e o dono do produto, no terminal dele.
     */
    const confirmar = args.includes('--confirmar')
    const prisma = createPrisma(url, { max: POOL_MAX })
    try {
      const { surveyAccounts, purgeAllAccounts } = await import('@/server/application/account/purge-accounts')
      const { SupabaseAuthAdmin } = await import('@/server/infrastructure/auth/supabase-auth-admin')
      const { SupabaseImageStorage } = await import('@/server/infrastructure/storage/supabase-image-storage')
      const auth = new SupabaseAuthAdmin()

      const survey = await surveyAccounts(prisma, auth)
      console.log(`[supabase] limpar-contas: ${survey.users.length} conta(s) no banco, ${survey.authUsers} no Supabase Auth`)
      for (const user of survey.users) {
        console.log(
          `  ${user.email}  desde ${user.createdAt.toISOString().slice(0, 10)}  ` +
            `cartas ${user.cards} | locais ${user.locations} | want list ${user.wants}`,
        )
      }
      console.log(
        `[supabase] limpar-contas: trocas ${survey.trades} | conversas ${survey.conversations} | ` +
          `denuncias ${survey.reports} | fotos ${survey.images}`,
      )
      console.log('[supabase] limpar-contas: catalogo, precos e cotacao ficam.')

      if (!confirmar) {
        console.log('[supabase] limpar-contas: nada foi apagado. Para apagar tudo acima, rode de novo com --confirmar.')
        return
      }

      const report = await purgeAllAccounts(prisma, {
        authAdmin: auth,
        directory: auth,
        images: new SupabaseImageStorage(),
      })
      console.log(
        `[supabase] limpar-contas: apagadas ${report.users} conta(s), ${report.trades} troca(s), ` +
          `${report.conversations} conversa(s), ${report.reports} denuncia(s)`,
      )
      console.log(
        `[supabase] limpar-contas: Supabase Auth ${report.authDeleted} apagada(s), ${report.authFailed} com falha | ` +
          `fotos ${report.imagesRemoved} apagada(s), ${report.imagesFailed} com falha`,
      )
      if (report.authFailed > 0) {
        console.log('[supabase] limpar-contas: rode de novo com --confirmar para terminar o Supabase Auth.')
        process.exitCode = 1
      }
    } finally {
      await prisma.$disconnect()
    }
    return
  }

  if (command === 'status') {
    const prisma = createPrisma(url, { max: POOL_MAX })
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
      'Use migrate, import, prices, contas, premium, aquecer, limpar-contas, status ou storage.',
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
