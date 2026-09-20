import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { listSets } from '@/server/application/catalog/list-sets'
import { searchCatalog } from '@/server/application/catalog/search-cards'
import { readCollectionDashboard } from '@/server/application/collection/dashboard'
import {
  getCollectionSummary,
  listPlaysets,
  readDashboard,
  searchCollection,
} from '@/server/application/collection/read-collection'
import { listNetwork } from '@/server/application/social/network'
import { listStorageLocations } from '@/server/application/storage/read-locations'
import { listWants } from '@/server/application/wants/read-wants'

/**
 * Quantas idas ao banco cada tela custa, e quanto tempo leva.
 *
 * Diagnóstico, não rotina: roda à mão contra o banco **local**, com a conta que
 * tiver mais cartas.
 *
 * O número que importa é a **contagem de consultas**, não o tempo: aqui a
 * latência é quase zero, e em produção cada ida custa alguns milissegundos
 * contra São Paulo. Uma tela com 300 consultas é rápida aqui e lenta lá — foi
 * assim que a leva de 131 cartas passou despercebida (armadilha 74).
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  log: [{ emit: 'event', level: 'query' }],
})

let consultas = 0
prisma.$on('query', () => {
  consultas++
})

/** Estimativa grosseira de ida e volta ao Supabase, medida em 19/09. */
const MS_POR_IDA = 4

async function medir(nome: string, tarefa: () => Promise<unknown>): Promise<void> {
  consultas = 0
  const inicio = Date.now()
  try {
    await tarefa()
    const ms = Date.now() - inicio
    console.log(
      `${nome.padEnd(40)} ${String(consultas).padStart(4)} consultas  ${String(ms).padStart(5)} ms local  ` +
        `~${consultas * MS_POR_IDA} ms só de rede em produção`,
    )
  } catch (erro) {
    console.log(`${nome.padEnd(40)} FALHOU: ${erro instanceof Error ? erro.message : erro}`)
  }
}

async function main(): Promise<void> {
  const dono = await prisma.user.findFirst({
    orderBy: { collection: { items: { _count: 'desc' } } },
    select: { id: true, email: true, name: true },
  })
  if (!dono) throw new Error('Nenhuma conta no banco local.')

  const itens = await prisma.collectionItem.count({ where: { collection: { userId: dono.id } } })
  console.log(`conta: ${dono.email} — ${itens} linhas de coleção\n`)

  const viewer: AuthenticatedUser = {
    id: dono.id,
    email: dono.email,
    name: dono.name,
    plan: 'PREMIUM',
    premiumUntil: new Date('2046-01-01'),
  }

  await medir('Início: dashboard Premium', () => readCollectionDashboard(prisma, viewer))
  await medir('Início: contagens', () => readDashboard(prisma, viewer))
  await medir('Minha Coleção: cabeçalho', () => getCollectionSummary(prisma, viewer))
  await medir('Minha Coleção: primeira página', () => searchCollection(prisma, viewer, { page: 1 }))
  await medir('Minha Coleção: playsets', () => listPlaysets(prisma, viewer))
  await medir('Catálogo: primeira página', () => searchCatalog(prisma, { page: 1, pageSize: 24 }))
  await medir('Catálogo: sets', () => listSets(prisma))
  await medir('Want list', () => listWants(prisma, viewer))
  await medir('Binders', () => listStorageLocations(prisma, viewer))
  await medir('Social: primeira página', () => listNetwork(prisma, viewer))

  await prisma.$disconnect()
}

main().catch((erro: unknown) => {
  console.error(erro)
  process.exit(1)
})
