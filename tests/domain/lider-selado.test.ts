import { describe, expect, it } from 'vitest'
import {
  isSealedLeaderCode,
  rotuloDeCores,
  sealedLeaderCardCode,
  SEALED_LEADER_PRODUCT_IDS,
  SEALED_LEADER_SET_CODE,
  TODAS_AS_CORES,
} from '@/server/domain/catalog/lider-selado'
import { ligaCardLink, ligaEdition } from '@/server/domain/catalog/liga'

/**
 * O líder de evento selado (decisão 115).
 *
 * A Bandai não o publica na lista de cartas, e ele não tem número de origem: o
 * código é nosso, derivado do `productId` do TCGplayer, como o do DON!!.
 */

describe('o código', () => {
  it('é o productId com o prefixo da linha selada', () => {
    expect(sealedLeaderCardCode(712746)).toBe('SB-712746')
    expect(sealedLeaderCardCode('712746')).toBe('SB-712746')
  })

  /* `cards.code` é `VarChar(20)`: um código que não coubesse quebraria no banco. */
  it('cabe nos 20 caracteres da coluna', () => {
    for (const id of SEALED_LEADER_PRODUCT_IDS) {
      expect(sealedLeaderCardCode(id).length).toBeLessThanOrEqual(20)
    }
  })

  it('reconhece o que é nosso e o que é da Bandai', () => {
    expect(isSealedLeaderCode('SB-712746')).toBe(true)
    expect(isSealedLeaderCode('sb-712746')).toBe(true)
    expect(isSealedLeaderCode('OP01-003')).toBe(false)
    expect(isSealedLeaderCode('P-047')).toBe(false)
    expect(isSealedLeaderCode('DON-482236')).toBe(false)
  })

  it('mora no set de promoções, que já existia', () => {
    expect(SEALED_LEADER_SET_CODE).toBe('PROMO')
  })
})

/**
 * O prefixo não é enfeite: ele mantém o link da Liga honesto.
 *
 * `ligaEdition` só reconhece `LETRAS+DÍGITOS-`. Um código como `SB712746-1`
 * produziria a edição "SB-71" e o link direto seria montado para uma carta que
 * a Liga não tem — exatamente o que o DON!! evita.
 */
describe('a Liga', () => {
  it('não deriva edição de um código nosso', () => {
    expect(ligaEdition('SB-712746')).toBeNull()
  })

  it('vai para a busca pelo nome, e não pelo código', () => {
    const link = ligaCardLink({
      cardCode: 'SB-712746',
      cardName: 'Monkey.D.Luffy (4th Anniversary Leader Card)',
      variantType: 'Normal',
    })

    expect(link.exact).toBe(false)
    expect(link.href).toContain('view=cards/search')
    expect(decodeURIComponent(link.href)).toContain('4th Anniversary Leader Card')
    // O codigo inventado nao pode vazar para a busca: la ele nao existe.
    expect(link.href).not.toContain('SB-712746')
  })

  /*
   * O caminho que o DON!! ensinou a testar: "conferido: nao existe pagina"
   * tambem cai na busca, e tambem pelo nome. O teste fraco aqui seria conferir
   * so que a busca e uma busca.
   */
  it('conferido como inexistente busca pelo nome', () => {
    const link = ligaCardLink({
      cardCode: 'SB-712746',
      cardName: 'Monkey.D.Luffy (4th Anniversary Leader Card)',
      variantType: 'Normal',
      verified: null,
    })

    expect(link.href).toContain('view=cards/search')
    expect(link.href).not.toContain('SB-712746')
  })
})

describe('o rótulo das cores', () => {
  it('escreve as seis como "todas as cores"', () => {
    expect(rotuloDeCores([...TODAS_AS_CORES])).toBe('todas as cores')
  })

  /* A ordem vem do banco e não é garantida: o rótulo não pode depender dela. */
  it('não depende da ordem em que as cores chegam', () => {
    expect(rotuloDeCores(['Yellow', 'Black', 'Purple', 'Blue', 'Green', 'Red'])).toBe(
      'todas as cores',
    )
  })

  it('um líder de duas cores continua escrito por extenso', () => {
    expect(rotuloDeCores(['Red', 'Green'])).toBe('Red e Green')
  })

  it('um líder de uma cor é só ela', () => {
    expect(rotuloDeCores(['Red'])).toBe('Red')
  })

  /* Cinco das seis não são todas: o rótulo mentiria sobre a que falta. */
  it('cinco cores não viram "todas"', () => {
    expect(rotuloDeCores(['Red', 'Green', 'Blue', 'Purple', 'Black'])).not.toBe('todas as cores')
  })

  it('sem cor nenhuma devolve vazio, e não "todas"', () => {
    expect(rotuloDeCores([])).toBe('')
  })
})

describe('a escolha de quais entram', () => {
  /*
   * A fonte traz quatro lideres de seis cores; o dono do produto escolheu um em
   * 25/11. Este teste guarda a escolha: acrescentar outro e decisao de produto,
   * e deve passar por aqui — nao acontecer sozinho.
   */
  it('é uma lista, e hoje é só o do 4º aniversário', () => {
    expect(SEALED_LEADER_PRODUCT_IDS).toEqual([712746])
  })
})
