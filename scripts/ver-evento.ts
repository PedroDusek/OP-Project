import 'dotenv/config'
import { createPrisma } from '@/server/infrastructure/prisma'

/**
 * O que a Stripe mandou, do jeito que ela mandou.
 *
 * Diagnóstico, só leitura. Existe porque a forma do aviso muda com a versão da
 * API — em 21/09 o `invoice.paid` chegou **antes** do
 * `checkout.session.completed`, e a data do ciclo não estava onde o código
 * procurava. Olhar o corpo guardado é mais rápido que adivinhar pela
 * documentação.
 *
 *   npx tsx scripts/ver-evento.ts invoice.paid
 */
async function main(): Promise<void> {
  const tipo = process.argv[2] ?? 'invoice.paid'
  const prisma = createPrisma(process.env.SUPABASE_DATABASE_URL!, { max: 2 })

  const evento = await prisma.paymentEvent.findFirst({
    where: { type: tipo },
    orderBy: { receivedAt: 'desc' },
    select: { payload: true, receivedAt: true },
  })
  if (!evento) {
    console.log(`nenhum evento do tipo ${tipo}`)
    await prisma.$disconnect()
    return
  }

  const objeto = (evento.payload as { data: { object: Record<string, unknown> } }).data.object
  console.log(`${tipo} recebido em ${evento.receivedAt.toISOString()}`)
  console.log('campos:', Object.keys(objeto).sort().join(', '))
  for (const campo of ['customer', 'subscription', 'parent', 'metadata', 'subscription_details', 'period_end', 'lines']) {
    if (objeto[campo] === undefined) continue
    const valor = JSON.stringify(objeto[campo])
    console.log(`\n${campo}: ${valor.length > 900 ? valor.slice(0, 900) + '…' : valor}`)
  }

  await prisma.$disconnect()
}

main().catch((erro: unknown) => {
  console.error(erro)
  process.exit(1)
})
