import 'dotenv/config'
import { createPrisma } from '@/server/infrastructure/prisma'

/**
 * O estado dos preços e da cotação em produção, só leitura.
 *
 * Diagnóstico, não rotina: responde "está atualizado?" com as duas datas que a
 * tela usa — quando **nós conferimos** (`price_imports.finished_at`) e de quando
 * é o **dado do mercado** (`source_updated_at`) — mais a cotação e quantos
 * preços mudaram por dia.
 */

async function main(): Promise<void> {
  const url = process.env.SUPABASE_DATABASE_URL
  if (!url) throw new Error('SUPABASE_DATABASE_URL nao esta definida.')
  const prisma = createPrisma(url, { max: 2 })

  const imp = await prisma.priceImport.findFirst({
    where: { finishedAt: { not: null }, failure: null },
    orderBy: { finishedAt: 'desc' },
    select: { finishedAt: true, sourceUpdatedAt: true, matched: true, written: true, unchanged: true },
  })
  const cambio = await prisma.exchangeRate.findFirst({
    orderBy: { quoteDate: 'desc' },
    select: { rate: true, quoteDate: true, source: true },
  })
  const porDia = await prisma.$queryRawUnsafe<{ dia: Date; quantas: bigint }[]>(
    `SELECT date(captured_at) AS dia, count(1)::bigint AS quantas
       FROM card_prices GROUP BY 1 ORDER BY 1 DESC LIMIT 6`,
  )

  const quando = (data?: Date | null) =>
    data ? `${data.toISOString().replace('T', ' ').slice(0, 16)} UTC` : 'nenhuma'

  console.log(`ultima importacao concluida: ${quando(imp?.finishedAt)}`)
  console.log(`dado do mercado (fonte):     ${quando(imp?.sourceUpdatedAt)}`)
  console.log(`casados ${imp?.matched} | gravados ${imp?.written} | sem mudanca ${imp?.unchanged}`)
  console.log(
    `cotacao: ${String(cambio?.rate)} de ${cambio?.quoteDate.toISOString().slice(0, 10)} (${cambio?.source})`,
  )
  console.log('precos gravados por dia:')
  for (const linha of porDia) {
    console.log(`  ${linha.dia.toISOString().slice(0, 10)}  ${Number(linha.quantas)}`)
  }

  await prisma.$disconnect()
}

main().catch((erro: unknown) => {
  console.error(erro)
  process.exit(1)
})
