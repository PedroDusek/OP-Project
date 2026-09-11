import { describe, expect, it } from 'vitest'
import { validateManualLinks } from '@/server/domain/prices/manual-links'
import {
  parseManualLinks,
  serializeManualLinks,
} from '@/server/infrastructure/prices/manual-links-file'

/**
 * O arquivo de vínculos manuais (decisão 068).
 *
 * O arquivo é aplicado pela importação de preço de produção. Um erro nele que
 * passasse em silêncio perderia o trabalho do dono do produto sem aviso; por isso
 * tudo que não fecha é recusado dizendo o quê.
 */

describe('as regras de consistencia', () => {
  it('aceita e devolve ordenado por arte', () => {
    const r = validateManualLinks([
      { variante: 'OP02-001_p1', produto: '2' },
      { variante: 'OP01-016_p3', produto: '1' },
    ])
    expect(r.map((l) => l.variante)).toEqual(['OP01-016_p3', 'OP02-001_p1'])
  })

  it('recusa a mesma arte duas vezes, dizendo qual', () => {
    expect(() =>
      validateManualLinks([
        { variante: 'OP01-016_p3', produto: '1' },
        { variante: 'OP01-016_p3', produto: '2' },
      ]),
    ).toThrow(/OP01-016_p3 aparece 2 vezes/)
  })

  it('recusa o mesmo produto para duas artes, dizendo quais', () => {
    expect(() =>
      validateManualLinks([
        { variante: 'OP01-016_p3', produto: '1' },
        { variante: 'OP01-016_p4', produto: '1' },
      ]),
    ).toThrow(/produto 1 foi dado a OP01-016_p3 e OP01-016_p4/)
  })

  /* `null` e uma resposta, e varias artes podem nao ter produto. */
  it('aceita varias artes sem produto', () => {
    expect(() =>
      validateManualLinks([
        { variante: 'OP01-016_p3', produto: null },
        { variante: 'OP01-016_p4', produto: null },
      ]),
    ).not.toThrow()
  })
})

describe('ler o arquivo', () => {
  it('le o formato valido', () => {
    const texto = JSON.stringify({
      fonte: 'tcgcsv',
      vinculos: [{ variante: 'OP01-016_p3', produto: '512345', nota: 'conferido' }],
    })
    expect(parseManualLinks(texto)).toEqual([
      { variante: 'OP01-016_p3', produto: '512345', nota: 'conferido' },
    ])
  })

  it('recusa JSON quebrado', () => {
    expect(() => parseManualLinks('{ nao e json')).toThrow(/não é JSON válido/)
  })

  it('recusa chave desconhecida em vez de ignorar', () => {
    const texto = JSON.stringify({
      fonte: 'tcgcsv',
      vinculos: [{ variante: 'OP01-016_p3', produtos: '1' }],
    })
    expect(() => parseManualLinks(texto)).toThrow(/formato inválido/)
  })

  it('recusa produto que nao e o id numerico da fonte', () => {
    const texto = JSON.stringify({ fonte: 'tcgcsv', vinculos: [{ variante: 'X_p1', produto: 'abc' }] })
    expect(() => parseManualLinks(texto)).toThrow(/id numerico da fonte/)
  })

  it('recusa arquivo de outra fonte', () => {
    expect(() => parseManualLinks(JSON.stringify({ fonte: 'outra', vinculos: [] }))).toThrow(
      /formato inválido/,
    )
  })
})

describe('gravar o arquivo', () => {
  /* Estavel para o diff do PR: mesma entrada, mesmo texto. */
  it('grava ordenado, com dois espacos e quebra no fim', () => {
    const texto = serializeManualLinks([
      { variante: 'OP02-001_p1', produto: null },
      { variante: 'OP01-016_p3', produto: '1' },
    ])
    expect(texto.endsWith('\n')).toBe(true)
    expect(texto.indexOf('OP01-016_p3')).toBeLessThan(texto.indexOf('OP02-001_p1'))
    expect(parseManualLinks(texto)).toHaveLength(2)
  })

  it('o arquivo do repositorio esta valido', async () => {
    const { loadManualLinks } = await import('@/server/infrastructure/prices/manual-links-file')
    expect(() => loadManualLinks()).not.toThrow()
  })
})
