import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Duas suites, dois ambientes.
 *
 * Antes deste checkpoint havia uma so, em Node, e um `globalSetup` que aplica
 * as migrations no banco de teste. Teste de componente nao precisa de banco
 * nenhum, e faze-lo esperar por migrations tornaria o ciclo de escrever
 * interface lento o bastante para as pessoas pararem de rodar os testes.
 *
 * Separadas em projetos, `npm test` continua rodando tudo, e
 * `npm run test:ui` roda so os componentes, sem PostgreSQL na maquina.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Os testes de integracao compartilham um unico banco. Rodar arquivos em
    // paralelo faria um truncate de um apagar os dados de outro. A opcao so
    // existe na raiz, entao vale para as duas suites.
    fileParallelism: false,
    projects: [
      {
        extends: true,
        test: {
          name: 'server',
          include: ['tests/domain/**/*.test.ts', 'tests/integration/**/*.test.ts', 'tests/unit/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['./tests/global-setup.ts'],
          // Aponta DATABASE_URL para o banco de teste antes de qualquer import,
          // para que o cliente Prisma da aplicacao nao toque o de desenvolvimento.
          setupFiles: ['./tests/setup-env.ts'],
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'components',
          include: ['tests/components/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['./tests/setup-dom.ts'],
        },
      },
    ],
  },
})
