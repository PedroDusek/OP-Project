import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

/**
 * Configuracao do Prisma CLI.
 *
 * A partir do Prisma 7 a URL de conexao nao fica mais no schema: migrations e
 * demais comandos do CLI leem daqui, e o PrismaClient usa um driver adapter.
 *
 * DATABASE_URL aponta para o banco de desenvolvimento. A suite de integracao
 * sobrescreve com TEST_DATABASE_URL, que e recriado pelas migrations e nunca
 * pode apontar para dados de desenvolvimento.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
