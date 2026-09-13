import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  bundledLigaCards,
  loadLigaCards,
  saveLigaCards,
} from '@/server/infrastructure/catalog/liga-cards-file'

/**
 * O arquivo `data/liga-cartas.json` (decisão 071).
 *
 * O primeiro teste lê o arquivo **do repositório**: ele decide o link de toda
 * paralela, e um arquivo quebrado num PR de conferência precisa reprovar a CI, e
 * não a página da carta em produção.
 */

describe('o arquivo do repositório', () => {
  it('é válido, e traz as paralelas da OP01 conferidas', () => {
    const tabela = bundledLigaCards()
    const zoro = tabela.find((entry) => entry.arte === 'OP01-001_p1')
    expect(zoro?.url).toContain('num=OP01-001-PAR')
    // A paralela da PROMO nao foi conferida: nao pode estar la por deducao.
    expect(tabela.some((entry) => entry.arte === 'OP01-004_p1')).toBe(false)
  })
})

describe('ler e gravar', () => {
  let pasta: string
  let caminho: string

  beforeEach(() => {
    pasta = mkdtempSync(join(tmpdir(), 'liga-'))
    caminho = join(pasta, 'liga.json')
  })

  afterEach(() => {
    rmSync(pasta, { recursive: true, force: true })
  })

  it('grava estável: ordenado por arte, sem nota vazia, com quebra no fim', () => {
    saveLigaCards(
      [
        { arte: 'OP01-013_p1', url: null, nota: 'a Liga não tem' },
        {
          arte: 'OP01-001_p1',
          url: 'https://www.ligaonepiece.com.br/?view=cards/card&ed=OP-01&num=OP01-001-PAR',
        },
      ],
      caminho,
    )

    const texto = readFileSync(caminho, 'utf8')
    expect(texto.endsWith('}\n')).toBe(true)
    expect(JSON.parse(texto).cartas.map((c: { arte: string }) => c.arte)).toEqual(['OP01-001_p1', 'OP01-013_p1'])
    expect(loadLigaCards(caminho)).toHaveLength(2)
  })

  /* Tabela vazia mandaria toda paralela para a busca sem ninguem ver. */
  it('recusa arquivo com chave desconhecida, em vez de ler vazio', () => {
    writeFileSync(caminho, JSON.stringify({ cartas: [{ arte: 'OP01-001_p1', URL: 'x' }] }))
    expect(() => loadLigaCards(caminho)).toThrow(/formato inválido/)
  })

  it('recusa arquivo que falta, dizendo onde procurou', () => {
    expect(() => loadLigaCards(join(pasta, 'nao-existe.json'))).toThrow(/não foi possível ler/)
  })
})
