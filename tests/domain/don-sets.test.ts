import { describe, expect, it } from 'vitest'
import { validateDonSets } from '@/server/domain/catalog/don-sets'

/**
 * A tabela que diz em que coleção cada DON!! saiu (decisão 112).
 *
 * São centenas de vínculos feitos à mão, e o arquivo vai para PR. Por isso a
 * regra recusa em vez de consertar, e ordena em vez de preservar a ordem de
 * chegada.
 */
describe('a tabela de sets do DON', () => {
  it('ordena artes e sets, para o arquivo nao mudar sem mudar de conteudo', () => {
    const tabela = validateDonSets([
      { arte: '200', sets: ['ST-01', 'OP01'] },
      { arte: '100', sets: ['OP02'] },
    ])

    expect(tabela).toEqual([
      { arte: '100', sets: ['OP02'] },
      { arte: '200', sets: ['OP01', 'ST-01'] },
    ])
  })

  /*
   * Arte repetida com listas diferentes nao tem resposta certa, e escolher uma
   * em silencio gravaria um vinculo que ninguem pediu (armadilha 5).
   */
  it('recusa a mesma arte duas vezes', () => {
    expect(() =>
      validateDonSets([
        { arte: '100', sets: ['OP01'] },
        { arte: '100', sets: ['OP02'] },
      ]),
    ).toThrow(/aparece mais de uma vez/)
  })

  it('recusa o mesmo set repetido na mesma arte', () => {
    expect(() => validateDonSets([{ arte: '100', sets: ['OP01', 'OP01'] }])).toThrow(/repete um set/)
  })

  it('recusa entrada sem arte', () => {
    expect(() => validateDonSets([{ arte: '   ', sets: ['OP01'] }])).toThrow(/sem arte/)
  })

  /* "Nao sei de onde e" e a ausencia da linha, e nao uma linha com lista vazia. */
  it('tira da tabela a arte que ficou sem set', () => {
    expect(validateDonSets([{ arte: '100', sets: [] }])).toEqual([])
    expect(validateDonSets([{ arte: '100', sets: ['  '] }])).toEqual([])
  })

  it('limpa espaco em volta', () => {
    expect(validateDonSets([{ arte: ' 100 ', sets: [' OP01 '] }])).toEqual([
      { arte: '100', sets: ['OP01'] },
    ])
  })
})
