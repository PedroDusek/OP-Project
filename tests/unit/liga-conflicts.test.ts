import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readLigaConflicts, recordConflictAnswer } from '@/server/application/prices/liga-conflicts'
import { NotFoundError, ValidationError } from '@/server/domain/errors'
import { ligaConflict } from '@/server/domain/prices/liga-conflicts'
import { saveLigaConflicts, type LigaConflict } from '@/server/infrastructure/prices/liga-conflicts-file'

/**
 * Os conflitos entre a Liga e os vínculos (decisão 074).
 *
 * A gravação roda contra arquivos temporários: gravar no
 * `data/vinculos-manuais.json` do repositório sujaria o PR seguinte com respostas
 * que ninguém deu.
 */

const liga = (card: string, num: string, ed = 'OP-09') =>
  `https://www.ligaonepiece.com.br/?view=cards/card&card=${encodeURIComponent(card)}&ed=${ed}&num=${num}`

const arte = (card: string, num: string) => ({
  cardCode: 'OP09-020',
  cardName: 'Come On',
  ligaUrl: liga(card, num),
  rarity: 'SP CARD',
  parallelSets: ['PRB-02'],
  normalSets: ['OP09'],
})

describe('o que é conflito', () => {
  it('acusa quando o produto vinculado tem outro tratamento', () => {
    expect(ligaConflict({ art: arte('Come On (Manga) (OP09-020-MA)', 'OP09-020-MA'), linkedLabel: 'Alternate Art' })).toBe('manga')
  })

  /* A comparacao e a mesma da regra: o que a importacao aceita, a tela nao acusa. */
  it('não acusa sinônimo, pontuação nem pedaço do nome', () => {
    expect(ligaConflict({ art: arte('Come On (SPR) (OP09-020)', 'OP09-020'), linkedLabel: 'SP' })).toBeNull()
    expect(
      ligaConflict({ art: arte('Come On (ST15 ST20 Release Event Pack) (X-EP)', 'X-EP'), linkedLabel: 'ST15 - ST20 Release Event Pack' }),
    ).toBeNull()
  })

  /* A Nami do ST31 estava numa SP da EB-05: a pagina diz que ela nao tem tratamento. */
  it('acusa a página sem tratamento de outra coleção vinculada a produto com tratamento', () => {
    const nami = { ...arte('Nami (OP01-016)', 'OP01-016'), cardCode: 'OP01-016', cardName: 'Nami', rarity: 'SR', ligaUrl: liga('Nami (OP01-016)', 'OP01-016', 'ST31') }
    expect(ligaConflict({ art: nami, linkedLabel: 'SP' })).toBe('sem tratamento em ST31')
    expect(ligaConflict({ art: nami, linkedLabel: '' })).toBeNull()
  })

  /* Com raridade SP CARD, a pagina sem tratamento e lida como SP (072): aqui a raridade e R. */
  it('sem tratamento na Liga, não há o que comparar', () => {
    const semTratamento = { ...arte('Come On (OP09-020)', 'OP09-020'), rarity: 'R' }
    expect(ligaConflict({ art: semTratamento, linkedLabel: 'Alternate Art' })).toBeNull()
  })
})

let pasta: string
let paths: { conflicts: string; manual: string }

const produto = (productId: string, label: string, value: number | null = null) => ({
  productId,
  label,
  groupCode: 'PRB-02',
  value,
})

const conflito: LigaConflict = {
  sourceId: 'OP09-020_p2',
  cardCode: 'OP09-020',
  cardName: 'Come On',
  rarity: 'SP CARD',
  imageUrl: null,
  sets: ['PRB-02'],
  liga: { url: liga('Come On (Manga) (OP09-020-MA)', 'OP09-020-MA', 'PRB2'), nome: 'Come On (Manga)', ed: 'PRB2', tratamento: 'manga' },
  vinculado: produto('653833', 'Alternate Art', 296.99),
  produtos: [produto('653833', 'Alternate Art', 296.99), produto('653840', 'Manga', 900)],
}

const manual = () => JSON.parse(readFileSync(paths.manual, 'utf8')).vinculos

beforeEach(() => {
  pasta = mkdtempSync(join(tmpdir(), 'conflitos-'))
  paths = { conflicts: join(pasta, 'conflitos.json'), manual: join(pasta, 'manual.json') }
  saveLigaConflicts([conflito], paths.conflicts)
  writeFileSync(paths.manual, JSON.stringify({ fonte: 'tcgcsv', vinculos: [] }))
})

afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(pasta, { recursive: true, force: true })
})

describe('a resposta de um conflito', () => {
  it('grava o produto certo no arquivo manual, e a tela vê a resposta', () => {
    recordConflictAnswer('OP09-020_p2', '653840', paths)

    expect(manual()).toEqual([{ variante: 'OP09-020_p2', produto: '653840' }])
    expect(readLigaConflicts(paths).respostas).toEqual({ 'OP09-020_p2': '653840' })
  })

  it('"nenhum destes" grava produto nulo', () => {
    recordConflictAnswer('OP09-020_p2', null, paths)
    expect(manual()).toEqual([{ variante: 'OP09-020_p2', produto: null }])
  })

  it('recusa produto que não é da carta, e arte fora do levantamento', () => {
    expect(() => recordConflictAnswer('OP09-020_p2', '999', paths)).toThrow(ValidationError)
    expect(() => recordConflictAnswer('OP01-001_p1', null, paths)).toThrow(NotFoundError)
    expect(manual()).toEqual([])
  })

  it('recusa dar a uma arte o produto que outra já tem no arquivo', () => {
    writeFileSync(paths.manual, JSON.stringify({ fonte: 'tcgcsv', vinculos: [{ variante: 'OP09-020_p1', produto: '653840' }] }))
    expect(() => recordConflictAnswer('OP09-020_p2', '653840', paths)).toThrow(ValidationError)
  })

  it('diz que o levantamento falta, sem quebrar', () => {
    rmSync(paths.conflicts)
    expect(readLigaConflicts(paths).levantamento).toBeNull()
  })

  it('recusa em produção', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => readLigaConflicts(paths)).toThrow(NotFoundError)
    expect(() => recordConflictAnswer('OP09-020_p2', null, paths)).toThrow(NotFoundError)
  })
})
