import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recordCardMapping, readMapping } from '@/server/application/prices/parallel-mapping'
import { NotFoundError, ValidationError } from '@/server/domain/errors'
import type { ParallelCandidate } from '@/server/domain/prices/parallel-candidates'
import { saveParallelCandidates } from '@/server/infrastructure/prices/parallel-candidates-file'

/**
 * O mapeamento manual visto pela tela `/dev/paralelas` (decisão 068).
 *
 * Tudo em arquivos temporários: o caso de uso grava `data/vinculos-manuais.json`
 * por padrão, e um teste que escrevesse no arquivo do repositório sujaria o PR
 * seguinte com respostas que ninguém deu.
 */

let pasta: string
let paths: { candidates: string; manual: string }

const levantamento: ParallelCandidate[] = [
  {
    cardCode: 'OP01-016',
    cardName: 'Nami',
    setCode: 'OP01',
    ours: [
      { sourceId: 'OP01-016_p1', rarity: 'R', imageUrl: null },
      { sourceId: 'OP01-016_p2', rarity: 'R', imageUrl: null },
    ],
    theirs: [
      { productId: '100', label: 'Alternate Art', value: 12.5 },
      { productId: '101', label: 'Manga', value: null },
    ],
  },
  {
    cardCode: 'OP02-001',
    cardName: 'Edward Newgate',
    setCode: 'OP02',
    ours: [{ sourceId: 'OP02-001_p1', rarity: 'L', imageUrl: null }],
    theirs: [{ productId: '200', label: 'Parallel', value: 3 }],
  },
]

const manual = (vinculos: unknown[]) =>
  writeFileSync(paths.manual, JSON.stringify({ fonte: 'tcgcsv', vinculos }), 'utf8')

const gravado = () => JSON.parse(readFileSync(paths.manual, 'utf8')).vinculos

beforeEach(() => {
  pasta = mkdtempSync(join(tmpdir(), 'paralelas-'))
  paths = { candidates: join(pasta, 'candidatas.json'), manual: join(pasta, 'manual.json') }
  saveParallelCandidates(levantamento, paths.candidates)
  manual([])
})

afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(pasta, { recursive: true, force: true })
})

describe('fora de desenvolvimento', () => {
  /* A acao de servidor pode ser chamada sem a pagina: a recusa tem de estar aqui. */
  it('recusa ler e gravar em producao', () => {
    vi.stubEnv('NODE_ENV', 'production')

    expect(() => readMapping(paths)).toThrow(NotFoundError)
    expect(() => recordCardMapping('OP01-016', [{ sourceId: 'OP01-016_p1', productId: '100' }], paths)).toThrow(
      NotFoundError,
    )
    expect(gravado()).toEqual([])
  })
})

describe('readMapping', () => {
  it('diz que o levantamento falta, sem quebrar', () => {
    rmSync(paths.candidates)
    expect(readMapping(paths).candidates).toBeNull()
  })

  it('devolve as respostas gravadas, inclusive "sem produto"', () => {
    manual([
      { variante: 'OP01-016_p1', produto: '100' },
      { variante: 'OP01-016_p2', produto: null },
    ])

    const view = readMapping(paths)
    expect(view.candidates?.cartas).toHaveLength(2)
    expect(view.answered).toBe(2)
    expect(view.answers).toEqual({ 'OP01-016_p1': '100', 'OP01-016_p2': null })
  })
})

describe('recordCardMapping', () => {
  it('grava o produto e a resposta "a fonte nao tem"', () => {
    const r = recordCardMapping(
      'OP01-016',
      [
        { sourceId: 'OP01-016_p2', productId: null },
        { sourceId: 'OP01-016_p1', productId: '101' },
      ],
      paths,
    )

    expect(r.recorded).toBe(2)
    expect(gravado()).toEqual([
      { variante: 'OP01-016_p1', produto: '101' },
      { variante: 'OP01-016_p2', produto: null },
    ])
  })

  /* Mudar de ideia sobre uma carta e gravar de novo, e nao acumular linhas. */
  it('substitui a resposta anterior da mesma arte e preserva as outras', () => {
    manual([
      { variante: 'OP01-016_p1', produto: '100' },
      { variante: 'ST01-001_p1', produto: '999', nota: 'feito a mao' },
    ])

    recordCardMapping('OP01-016', [{ sourceId: 'OP01-016_p1', productId: '101' }], paths)

    expect(gravado()).toEqual([
      { variante: 'OP01-016_p1', produto: '101' },
      { variante: 'ST01-001_p1', produto: '999', nota: 'feito a mao' },
    ])
  })

  it('mantem a nota quando a resposta regravada e a mesma', () => {
    manual([{ variante: 'OP01-016_p1', produto: '100', nota: 'a do fundo azul' }])

    recordCardMapping('OP01-016', [{ sourceId: 'OP01-016_p1', productId: '100' }], paths)

    expect(gravado()).toEqual([{ variante: 'OP01-016_p1', produto: '100', nota: 'a do fundo azul' }])
  })

  it('recusa carta fora do levantamento', () => {
    expect(() => recordCardMapping('OP09-999', [{ sourceId: 'OP09-999_p1', productId: null }], paths)).toThrow(
      NotFoundError,
    )
  })

  it('recusa arte de outra carta', () => {
    expect(() => recordCardMapping('OP01-016', [{ sourceId: 'OP02-001_p1', productId: null }], paths)).toThrow(
      /OP02-001_p1 não é uma paralela pendente de OP01-016/,
    )
  })

  it('recusa produto de outra carta', () => {
    expect(() => recordCardMapping('OP01-016', [{ sourceId: 'OP01-016_p1', productId: '200' }], paths)).toThrow(
      /produto 200 não é uma arte de OP01-016/,
    )
  })

  it('recusa gravar sem resposta nenhuma', () => {
    expect(() => recordCardMapping('OP01-016', [], paths)).toThrow(ValidationError)
  })

  /* O arquivo nao fica pela metade: nenhuma das duas respostas entra. */
  it('recusa o mesmo produto para duas artes, sem gravar nada', () => {
    const tentar = () =>
      recordCardMapping(
        'OP01-016',
        [
          { sourceId: 'OP01-016_p1', productId: '100' },
          { sourceId: 'OP01-016_p2', productId: '100' },
        ],
        paths,
      )

    expect(tentar).toThrow(ValidationError)
    expect(tentar).toThrow(/produto 100 foi dado a OP01-016_p1 e OP01-016_p2/)
    expect(gravado()).toEqual([])
  })

  it('recusa produto que uma resposta anterior de outra arte ja segura', () => {
    manual([{ variante: 'OP01-016_p1', produto: '100' }])

    expect(() => recordCardMapping('OP01-016', [{ sourceId: 'OP01-016_p2', productId: '100' }], paths)).toThrow(
      ValidationError,
    )
    expect(gravado()).toEqual([{ variante: 'OP01-016_p1', produto: '100' }])
  })
})
