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
 */

function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  })
}

/**
 * Cria um cliente novo para uma URL especifica.
 *
 * Usado pela suite de integracao, que roda contra TEST_DATABASE_URL. Fora dos
 * testes, use a instancia exportada abaixo.
 */
export function createPrisma(connectionString: string): PrismaClient {
  return createPrismaClient(connectionString)
}

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL nao esta definida. Copie .env.example para .env.')
  }
  return url
}

// Em desenvolvimento o Next.js recarrega modulos a cada alteracao. Sem guardar a
// instancia no escopo global, cada recarga abriria um novo pool de conexoes ate
// o PostgreSQL recusar novas conexoes.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient(resolveDatabaseUrl())

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
