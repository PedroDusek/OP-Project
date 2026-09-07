import { defineConfig, devices } from '@playwright/test'

/**
 * Testes ponta a ponta.
 *
 * Neste checkpoint eles cobrem uma coisa que nenhum outro nivel alcanca: o
 * comportamento responsivo. O jsdom nao avalia media query — para ele
 * `md:hidden` e uma string — entao um teste de componente pode passar com a
 * barra inferior aparecendo no desktop e a lateral no celular ao mesmo tempo.
 * So um navegador de verdade, em tres larguras, responde isso
 * (`architecture.md` secao 6).
 *
 * Roda contra o build de producao, e nao contra `next dev`: e o artefato que
 * vai para producao, sem overlay de desenvolvimento por cima dos elementos.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',

  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'npm run start -- --port 3100',
    url: 'http://127.0.0.1:3100/inicio',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
