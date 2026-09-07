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
const BASE_URL = 'http://127.0.0.1:3100'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'npm run start -- --port 3100',
    url: `${BASE_URL}/entrar`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      /*
       * O servidor de teste e um build de producao, e em producao a aplicacao
       * **exige** APP_URL: e dela que saem os links de confirmacao de e-mail e
       * de redefinicao de senha, e derivar isso do cabecalho `Host` deixaria
       * quem chama escolher o destino de um link que cria sessao.
       *
       * Aqui ela precisa ser o endereco deste servidor, e nao o do `.env` de
       * quem esta rodando: com o valor errado, o retorno de `/auth/callback`
       * redireciona para outra origem e os testes passam ou falham conforme o
       * servidor de desenvolvimento esteja de pe — que foi exatamente o que
       * aconteceu antes de esta linha existir.
       */
      APP_URL: BASE_URL,
    },
  },
})
