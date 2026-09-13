import { describe, expect, it } from 'vitest'
import {
  ligaCardLink,
  ligaEdition,
  ligaSearchLink,
  ligaSuffix,
  parseLigaUrl,
} from '@/server/domain/catalog/liga'
import { ligaLookup, validateLigaCards } from '@/server/domain/catalog/liga-cards'

/**
 * O endereço de uma carta na LigaOnePiece (decisões 047 e 071).
 *
 * O primeiro caso é um **endereço real**, conferido pelo dono do produto no
 * site. É o contrato da montagem da normal: se ela mudar de forma, ele quebra
 * antes de alguém descobrir pelo link torto.
 */

const ZORO = { cardCode: 'OP01-001', cardName: 'Roronoa Zoro' }
const ZORO_PAR =
  'https://www.ligaonepiece.com.br/?view=cards/card&card=Roronoa+Zoro%20(OP01-001-PAR)&ed=OP-01&num=OP01-001-PAR'

describe('a normal', () => {
  it('monta o endereço exatamente como o site', () => {
    expect(ligaCardLink({ ...ZORO, variantType: 'Normal' })).toEqual({
      exact: true,
      href:
        'https://www.ligaonepiece.com.br/?view=cards/card' +
        '&card=Roronoa%20Zoro%20(OP01-001)&ed=OP-01&num=OP01-001',
    })
  })

  /** Espaço vira `%20` e o parêntese fica literal, como o site escreve. */
  it('escreve espaço como %20, e não como +', () => {
    const { href } = ligaCardLink({ ...ZORO, variantType: 'Normal' })

    expect(href).toContain('Roronoa%20Zoro')
    expect(href).not.toContain('+')
  })

  /* A exceção conferida vence a montagem. */
  it('usa o endereço da tabela quando a normal foi conferida', () => {
    const conferido = 'https://www.ligaonepiece.com.br/?view=cards/card&card=X&ed=OP-02&num=OP02-001-N'
    expect(ligaCardLink({ ...ZORO, variantType: 'Normal', verified: conferido })).toEqual({
      exact: true,
      href: conferido,
    })
  })

  it('promo sem número de edição cai na busca', () => {
    const link = ligaCardLink({ cardCode: 'P-069', cardName: 'Monkey.D.Luffy', variantType: 'Normal' })

    expect(link).toEqual({ exact: false, href: ligaSearchLink('P-069') })
  })
})

describe('a paralela só vai direto conferida', () => {
  it('usa o endereço conferido, como a Liga o produziu', () => {
    expect(ligaCardLink({ ...ZORO, variantType: 'Parallel', verified: ZORO_PAR })).toEqual({
      exact: true,
      href: ZORO_PAR,
    })
  })

  /*
   * A regra mudou com a decisao 071. A 047 dava `-PAR` a toda carta com uma
   * paralela so, e a `OP01-004_p1` — que so existe na PROMO — ganhava
   * `OP01-004-PAR`, que e outra arte. Sem conferencia, vai para a busca.
   */
  it('a paralela única, sem conferência, vai para a busca', () => {
    const link = ligaCardLink({ cardCode: 'OP01-004', cardName: 'Usopp', variantType: 'Parallel' })

    expect(link).toEqual({ exact: false, href: ligaSearchLink('OP01-004') })
  })

  it('"não existe na Liga" vai para a busca', () => {
    expect(ligaCardLink({ ...ZORO, variantType: 'Parallel', verified: null }).exact).toBe(false)
  })

  /** Um tipo de arte que o catálogo não conhece nunca vira palpite. */
  it('variante desconhecida cai na busca', () => {
    expect(ligaCardLink({ ...ZORO, variantType: 'Manga' }).exact).toBe(false)
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

describe('ler o endereço colado', () => {
  it('tira edição e código, e guarda o endereço como veio', () => {
    expect(parseLigaUrl(`  ${ZORO_PAR} `)).toEqual({ url: ZORO_PAR, ed: 'OP-01', num: 'OP01-001-PAR' })
  })

  it('recusa o que não é endereço, nem da Liga, nem de carta', () => {
    expect(parseLigaUrl('OP01-001-PAR')).toEqual({ error: 'Não é um endereço.' })
    expect(parseLigaUrl('https://example.com/?view=cards/card&ed=OP-01&num=OP01-001')).toHaveProperty('error')
    expect(parseLigaUrl(ligaSearchLink('OP01-001'))).toHaveProperty('error')
  })

  it('recusa sem edição ou sem código', () => {
    expect(parseLigaUrl('https://www.ligaonepiece.com.br/?view=cards/card&num=OP01-001')).toEqual({
      error: 'O endereço não tem a edição (ed).',
    })
    expect(parseLigaUrl('https://www.ligaonepiece.com.br/?view=cards/card&ed=OP-01')).toEqual({
      error: 'O endereço não tem o código da carta (num).',
    })
  })
})

describe('o sufixo da Liga', () => {
  /* Cada colecao pode ter o seu: por isso ele e lido, e nunca deduzido. */
  it('lê o que vem depois do código', () => {
    expect(ligaSuffix('OP01-001-PAR', 'OP01-001')).toBe('PAR')
    expect(ligaSuffix('OP02-004-E', 'OP02-004')).toBe('E')
    expect(ligaSuffix('OP01-001', 'OP01-001')).toBe('')
  })

  it('devolve nulo quando a Liga usou outro código', () => {
    expect(ligaSuffix('P-001', 'OP01-004')).toBeNull()
    expect(ligaSuffix('OP01-0010', 'OP01-001')).toBeNull()
  })
})

describe('a tabela conferida', () => {
  it('ordena por arte e vira consulta', () => {
    const tabela = validateLigaCards([
      { arte: 'OP01-013_p1', url: null },
      { arte: 'OP01-001_p1', url: ZORO_PAR },
    ])
    expect(tabela.map((entry) => entry.arte)).toEqual(['OP01-001_p1', 'OP01-013_p1'])

    const consulta = ligaLookup(tabela)
    expect(consulta.get('OP01-001_p1')).toBe(ZORO_PAR)
    expect(consulta.get('OP01-013_p1')).toBeNull()
    // Ausente e "nao conferida", e nao "sem pagina".
    expect(consulta.get('OP01-004_p1')).toBeUndefined()
  })

  it('recusa arte repetida e endereço que não é de carta, dizendo qual', () => {
    expect(() =>
      validateLigaCards([
        { arte: 'OP01-001_p1', url: ZORO_PAR },
        { arte: 'OP01-001_p1', url: null },
      ]),
    ).toThrow(/a arte OP01-001_p1 aparece 2 vezes/)
    expect(() => validateLigaCards([{ arte: 'OP01-004_p1', url: 'https://example.com' }])).toThrow(
      /OP01-004_p1: O endereço não é da Liga/,
    )
  })
})
