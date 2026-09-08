import { describe, expect, it } from 'vitest'
import { ligaCardLink, ligaEdition, ligaSearchLink } from '@/server/domain/catalog/liga'

/**
 * O endereço de uma carta na LigaOnePiece.
 *
 * Os dois primeiros casos são **endereços reais**, conferidos pelo dono do
 * produto no site. São o contrato: se a montagem mudar de forma, estes dois
 * quebram antes de alguém descobrir pelo link torto.
 */

const ZORO = { cardCode: 'OP01-001', cardName: 'Roronoa Zoro' }

describe('link direto para a carta', () => {
  it('monta o endereço da arte normal exatamente como o site', () => {
    expect(ligaCardLink({ ...ZORO, variantType: 'Normal', parallelCount: 1 })).toEqual({
      exact: true,
      href:
        'https://www.ligaonepiece.com.br/?view=cards/card' +
        '&card=Roronoa%20Zoro%20(OP01-001)&ed=OP-01&num=OP01-001',
    })
  })

  it('monta o endereço da arte paralela exatamente como o site', () => {
    expect(ligaCardLink({ ...ZORO, variantType: 'Parallel', parallelCount: 1 })).toEqual({
      exact: true,
      href:
        'https://www.ligaonepiece.com.br/?view=cards/card' +
        '&card=Roronoa%20Zoro%20(OP01-001-PAR)&ed=OP-01&num=OP01-001-PAR',
    })
  })

  /** Espaço vira `%20` e o parêntese fica literal, como o site escreve. */
  it('escreve espaço como %20, e não como +', () => {
    const { href } = ligaCardLink({ ...ZORO, variantType: 'Normal', parallelCount: 1 })

    expect(href).toContain('Roronoa%20Zoro')
    expect(href).not.toContain('+')
    expect(href).toContain('view=cards/card')
  })
})

describe('a edição sai do código da carta', () => {
  /**
   * E não do código do set: `OP14-EB04` reúne cartas `OP14-…` e `EB04-…`, e é
   * o código de cada uma que diz a qual edição ela pertence lá.
   */
  it('separa as duas edições de um set duplo', () => {
    expect(ligaEdition('OP14-001')).toBe('OP-14')
    expect(ligaEdition('EB04-012')).toBe('EB-04')
  })

  it('completa dois dígitos', () => {
    expect(ligaEdition('OP1-001')).toBe('OP-01')
    expect(ligaEdition('ST13-001')).toBe('ST-13')
  })

  it('aceita prefixo de mais de duas letras', () => {
    expect(ligaEdition('PRB01-001')).toBe('PRB-01')
  })

  /** Promo `P-069` não tem número de edição. */
  it('devolve nulo quando não há número de edição', () => {
    expect(ligaEdition('P-069')).toBeNull()
    expect(ligaEdition('')).toBeNull()
  })
})

describe('quando não dá para ter certeza, vai para a busca', () => {
  /**
   * 501 cartas do catálogo têm mais de uma arte paralela — até dez. O sufixo
   * `-PAR` sozinho não diz qual, e chutar levaria à arte errada.
   */
  it('carta com várias paralelas cai na busca', () => {
    const link = ligaCardLink({
      cardCode: 'OP01-016',
      cardName: 'Nami',
      variantType: 'Parallel',
      parallelCount: 8,
    })

    expect(link.exact).toBe(false)
    expect(link.href).toBe(ligaSearchLink('OP01-016'))
  })

  /** A arte normal continua direta, mesmo com muitas paralelas ao lado. */
  it('a normal da mesma carta continua indo direto', () => {
    const link = ligaCardLink({
      cardCode: 'OP01-016',
      cardName: 'Nami',
      variantType: 'Parallel',
      parallelCount: 8,
    })
    const normal = ligaCardLink({
      cardCode: 'OP01-016',
      cardName: 'Nami',
      variantType: 'Normal',
      parallelCount: 8,
    })

    expect(link.exact).toBe(false)
    expect(normal.exact).toBe(true)
    expect(normal.href).toContain('num=OP01-016')
  })

  it('promo sem número de edição cai na busca', () => {
    const link = ligaCardLink({
      cardCode: 'P-069',
      cardName: 'Monkey.D.Luffy',
      variantType: 'Normal',
      parallelCount: 0,
    })

    expect(link.exact).toBe(false)
    expect(link.href).toContain('view=cards/search')
    expect(link.href).toContain('card=P-069')
  })

  /** Um tipo de arte que o catálogo não conhece nunca vira palpite. */
  it('variante desconhecida cai na busca', () => {
    const link = ligaCardLink({ ...ZORO, variantType: 'Manga', parallelCount: 1 })

    expect(link.exact).toBe(false)
  })
})

describe('a busca', () => {
  it('procura pelo código', () => {
    expect(ligaSearchLink('OP01-001')).toBe(
      'https://www.ligaonepiece.com.br/?view=cards/search&card=OP01-001',
    )
  })

  it('ignora espaço em volta do código', () => {
    expect(ligaSearchLink('  OP01-001 ')).toBe(ligaSearchLink('OP01-001'))
  })
})
