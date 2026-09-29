import { describe, expect, it } from 'vitest'
import { rotaParaOficial } from '@/lib/dominio'

/**
 * O endereço antigo leva ao oficial (21/09).
 *
 * `colexa.fly.dev` continua respondendo, e um link antigo aberto ali criaria
 * uma segunda versão do site: sessão em outro domínio, e conteúdo repetido em
 * dois endereços aos olhos do buscador.
 */

const OFICIAL = 'https://colexa.com.br'

describe('rotaParaOficial', () => {
  it('leva o caminho e a busca junto', () => {
    expect(rotaParaOficial('colexa.fly.dev', '/catalogo', '?cor=Red&pagina=2', OFICIAL)).toBe(
      'https://colexa.com.br/catalogo?cor=Red&pagina=2',
    )
  })

  it('não mexe em quem já está no domínio oficial', () => {
    expect(rotaParaOficial('colexa.com.br', '/inicio', '', OFICIAL)).toBeNull()
    expect(rotaParaOficial('www.colexa.com.br', '/inicio', '', OFICIAL)).toBeNull()
  })

  it('não mexe no desenvolvimento local', () => {
    expect(rotaParaOficial('localhost', '/inicio', '', OFICIAL)).toBeNull()
    expect(rotaParaOficial('127.0.0.1', '/inicio', '', OFICIAL)).toBeNull()
  })

  /*
   * A Fly espera 2xx da checagem de saúde; um redirecionamento seria lido como
   * máquina doente, e derrubaria a publicação inteira.
   */
  it('deixa a checagem de saúde em paz', () => {
    expect(rotaParaOficial('colexa.fly.dev', '/api/saude', '', OFICIAL)).toBeNull()
  })

  /* Sem endereço oficial configurado não há para onde ir — e nunca um laço. */
  it('não redireciona sem destino, nem para o próprio host', () => {
    expect(rotaParaOficial('colexa.fly.dev', '/inicio', '', undefined)).toBeNull()
    expect(rotaParaOficial('colexa.fly.dev', '/inicio', '', 'https://colexa.fly.dev')).toBeNull()
    expect(rotaParaOficial('colexa.fly.dev', '/inicio', '', 'isto nao e uma url')).toBeNull()
  })

  it('ignora porta e caixa do endereço', () => {
    expect(rotaParaOficial('COLEXA.FLY.DEV:443', '/quero', '', OFICIAL)).toBe(
      'https://colexa.com.br/quero',
    )
  })
})
