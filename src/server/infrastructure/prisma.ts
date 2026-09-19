import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

/**
 * Cliente Prisma da aplicacao.
 *
 * Camada: infrastructure. Apenas `application` importa daqui.
 * `app/` e `components/` nunca importam este modulo diretamente.
 *
 * A partir do Prisma 7 a conexao passa por um driver adapter em vez da URL no
 * schema. Ver docs/architecture.md secao 2.
 *
 * ## Quantas conexoes, e por que isso derrubou uma pagina (19/09)
 *
 * Em producao o banco e alcancado pelo Session pooler do Supabase, que aceita
 * **15 clientes ao todo** — somando o site, a tarefa de precos e qualquer
 * comando `npm run supabase`. Passou disso, a consulta falha com
 * `EMAXCONNSESSION` e a pessoa ve a tela de erro.
 *
 * Foi o que aconteceu: o build do Next copia este modulo em **quatro** pedacos
 * do servidor (conferido em `.next/server`), e cada copia criava o proprio
 * cliente, com o padrao do driver de ate 10 conexoes. Ate 40, contra 15. A
 * guarda no `globalThis` existia so em desenvolvimento; agora vale sempre, e
 * as quatro copias dividem um cliente.
 *
 * E o teto e explicito: 8 para o site, deixando 7 para a tarefa de precos e
 * para os comandos de producao, que pedem poucas (`createPrisma(url, { max })`).
 */

/** Conexoes do site. Abaixo dos 15 do Session pooler, com folga para as tarefas. */
export const APP_POOL_MAX = 8

function createPrismaClient(connectionString: string, max?: number): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, ...(max ? { max } : {}) }),
  })
}

/**
 * Cria um cliente novo para uma URL especifica.
 *
 * Usado pela suite de integracao, que roda contra TEST_DATABASE_URL, e pelos
 * scripts. Fora deles, use a instancia exportada abaixo. `max` limita as
 * conexoes; sem ele vale o padrao do driver (10), que o banco local aguenta.
 */
export function createPrisma(connectionString: string, options: { max?: number } = {}): PrismaClient {
  return createPrismaClient(connectionString, options.max)
}

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL nao esta definida. Copie .env.example para .env.')
  }
  return url
}

// Uma instancia por processo, em desenvolvimento e em producao. Em
// desenvolvimento o Next recarrega modulos a cada alteracao; em producao ele
// copia este modulo em varios pedacos do servidor. Nos dois casos, sem o
// `globalThis`, cada copia abriria o proprio pool — ver o comentario do topo.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient(resolveDatabaseUrl(), APP_POOL_MAX)

globalForPrisma.prisma = prisma
