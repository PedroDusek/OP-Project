import { afterEach, describe, expect, it, vi } from 'vitest'
import { appUrl } from '@/server/http/app-url'

// `vi.stubEnv` e o caminho para `NODE_ENV`: o Node o define como propriedade
// nao configuravel, entao `Object.defineProperty` sobre ele falha.
afterEach(() => {
  vi.unstubAllEnvs()
})

/**
 * A base da aplicacao decide para onde o link de redefinicao de senha aponta, e
 * esse link carrega um codigo que cria sessao. Por isso vem de configuracao, e
 * nunca do cabecalho `Host`, que quem chama controla.
 */
describe('appUrl', () => {
  it('usa a variavel de ambiente', () => {
    vi.stubEnv('APP_URL', 'https://colexa.com.br')
    expect(appUrl()).toBe('https://colexa.com.br')
  })

  it('remove a barra final, para nao montar URL com barra dupla', () => {
    vi.stubEnv('APP_URL', 'https://colexa.com.br/')
    expect(appUrl()).toBe('https://colexa.com.br')
    expect(new URL('/auth/callback', appUrl()).toString()).toBe(
      'https://colexa.com.br/auth/callback',
    )
  })

  it('cai no localhost fora de producao', () => {
    vi.stubEnv('APP_URL', '')
    vi.stubEnv('NODE_ENV', 'development')
    expect(appUrl()).toBe('http://localhost:3000')
  })

  /**
   * Em producao, falhar e melhor que mandar um e-mail com link para localhost:
   * o link nao funcionaria para ninguem, e a falha so apareceria na caixa de
   * entrada de outra pessoa.
   */
  it('falha em producao sem configuracao', () => {
    vi.stubEnv('APP_URL', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => appUrl()).toThrow(/APP_URL/)
  })
})
