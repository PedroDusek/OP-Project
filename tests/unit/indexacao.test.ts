import { describe, expect, it } from 'vitest'
import { indexingAllowed, podeIndexar } from '@/lib/indexacao'

/**
 * Quem aparece em busca (decisão 092, ajustada em 21/09).
 *
 * O teste existe porque o modo de falha é silencioso nos dois sentidos: indexar
 * cedo demais só se descobre pesquisando no Google semanas depois, e não
 * indexar no dia do lançamento não avisa ninguém.
 */

describe('podeIndexar', () => {
  it('libera só no domínio oficial e com a chave ligada', () => {
    expect(podeIndexar('colexa.com.br', '1')).toBe(true)
    expect(podeIndexar('www.colexa.com.br', 'true')).toBe(true)
  })

  /* O caso que motivou a mudança: migrar de endereço não pode ligar a busca. */
  it('o domínio oficial sozinho não basta', () => {
    expect(podeIndexar('colexa.com.br', undefined)).toBe(false)
    expect(podeIndexar('colexa.com.br', '')).toBe(false)
    expect(podeIndexar('colexa.com.br', '0')).toBe(false)
  })

  it('a chave sozinha também não basta', () => {
    expect(podeIndexar('colexa.fly.dev', '1')).toBe(false)
    expect(podeIndexar('localhost', '1')).toBe(false)
    expect(podeIndexar(null, '1')).toBe(false)
  })

  /* O `Host` vem com porta em desenvolvimento e pode vir em maiúsculas. */
  it('ignora porta e caixa do endereço', () => {
    expect(podeIndexar('COLEXA.COM.BR', 'sim')).toBe(true)
    expect(podeIndexar('colexa.com.br:443', 'sim')).toBe(true)
  })

  it('aceita 1, true e sim, e recusa o resto', () => {
    for (const valor of ['1', 'true', 'TRUE', 'sim', ' Sim ']) {
      expect(indexingAllowed(valor)).toBe(true)
    }
    for (const valor of [undefined, '', '0', 'false', 'nao', 'talvez']) {
      expect(indexingAllowed(valor)).toBe(false)
    }
  })
})
