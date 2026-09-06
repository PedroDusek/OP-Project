import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    // Os testes de integracao compartilham um unico banco. Rodar arquivos em
    // paralelo faria um truncate de um arquivo apagar os dados de outro.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
})
