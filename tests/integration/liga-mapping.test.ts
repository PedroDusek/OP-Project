import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCardVariant } from '@/server/application/catalog/get-card-variant'
import {
  clearLigaCard,
  confirmReprint,
  readLigaWorksheet,
  readReprintReview,
  recordLigaCard,
} from '@/server/application/catalog/liga-mapping'
import { ligaSearchLink } from '@/server/domain/catalog/liga'
import { NotFoundError, ValidationError } from '@/server/domain/errors'
import { disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * O link da Liga e a conferência coleção a coleção, contra o banco (decisão 071).
 *
 * O arranjo é o do relato: a Zoro `OP01-001` com a paralela da OP01 e outra da
 * PROMO, e a Usopp `OP01-004`, cuja única paralela só existe na PROMO — e ganhava
 * `OP01-004-PAR`, que é outra arte.
 *
 * A tabela é sempre um arquivo temporário: gravar no `data/liga-cartas.json` do
 * repositório sujaria o PR seguinte com conferências que ninguém fez.
 */

const ZORO_PAR =
  'https://www.ligaonepiece.com.br/?view=cards/card&card=Roronoa+Zoro%20(OP01-001-PAR)&ed=OP-01&num=OP01-001-PAR'

let pasta: string
let tabela: string
const ids: Record<string, bigint> = {}

async function arte(cardId: bigint, sourceId: string, rarity: string, ...setCodes: string[]) {
  const db = testPrisma()
  const criada = await db.cardVariant.create({
    data: {
      cardId,
      sourceId,
      rarity,
      variantType: sourceId.includes('_p') ? 'Parallel' : 'Normal',
      printings: {
        create: await Promise.all(
          setCodes.map(async (code) => ({ setId: (await db.set.findUniqueOrThrow({ where: { code } })).id })),
        ),
      },
    },
  })
  ids[sourceId] = criada.id
}

beforeEach(async () => {
  await resetDatabase()
  const db = testPrisma()
  for (const code of ['OP01', 'PROMO', 'ST-17']) await db.set.create({ data: { code, name: code } })

  const zoro = await db.card.create({ data: { code: 'OP01-001', name: 'Roronoa Zoro', type: 'Leader' } })
  await arte(zoro.id, 'OP01-001', 'L', 'OP01')
  await arte(zoro.id, 'OP01-001_p1', 'L', 'OP01')
  await arte(zoro.id, 'OP01-001_p2', 'L', 'PROMO')

  const usopp = await db.card.create({ data: { code: 'OP01-004', name: 'Usopp', type: 'Character' } })
  await arte(usopp.id, 'OP01-004', 'R', 'OP01')
  await arte(usopp.id, 'OP01-004_p1', 'R', 'PROMO')

  const doflamingo = await db.card.create({ data: { code: 'OP01-073', name: 'Donquixote Doflamingo', type: 'Character' } })
  await arte(doflamingo.id, 'OP01-073', 'R', 'ST-17', 'OP01')

  pasta = mkdtempSync(join(tmpdir(), 'liga-'))
  tabela = join(pasta, 'liga.json')
  writeFileSync(tabela, JSON.stringify({ cartas: [{ arte: 'OP01-001_p1', url: ZORO_PAR }] }))
})

afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(pasta, { recursive: true, force: true })
})

afterAll(async () => {
  await disconnect()
})

const consulta = () => new Map([['OP01-001_p1', ZORO_PAR as string | null]])

describe('o link na página da carta', () => {
  it('a paralela conferida vai para o endereço da tabela', async () => {
    const v = await getCardVariant(testPrisma(), ids['OP01-001_p1'], consulta())
    expect(v.liga).toEqual({ exact: true, href: ZORO_PAR })
  })

  /* O defeito relatado: a unica paralela, impressa so na PROMO, nao ganha -PAR. */
  it('a paralela da PROMO não conferida vai para a busca', async () => {
    const usopp = await getCardVariant(testPrisma(), ids['OP01-004_p1'], consulta())
    expect(usopp.liga).toEqual({ exact: false, href: ligaSearchLink('OP01-004') })

    const promoDaZoro = await getCardVariant(testPrisma(), ids['OP01-001_p2'], consulta())
    expect(promoDaZoro.liga.exact).toBe(false)
  })

  it('a normal continua direta sem conferência', async () => {
    const v = await getCardVariant(testPrisma(), ids['OP01-004'], consulta())
    expect(v.liga).toEqual({
      exact: true,
      href: 'https://www.ligaonepiece.com.br/?view=cards/card&card=Usopp%20(OP01-004)&ed=OP-01&num=OP01-004',
    })
  })
})

describe('a planilha de uma coleção', () => {
  it('separa o que foi impresso na coleção do que só saiu em outro produto', async () => {
    const w = await readLigaWorksheet(testPrisma(), 'OP01', tabela)

    expect(w.rows.filter((r) => r.inSet).map((r) => r.sourceId)).toEqual([
      'OP01-001',
      'OP01-001_p1',
      'OP01-004',
      'OP01-073',
    ])
    expect(w.rows.filter((r) => !r.inSet).map((r) => r.sourceId)).toEqual(['OP01-001_p2', 'OP01-004_p1'])
  })

  it('mostra o código, a edição e o sufixo lidos do endereço conferido', async () => {
    const w = await readLigaWorksheet(testPrisma(), 'OP01', tabela)
    const zoro = w.rows.find((r) => r.sourceId === 'OP01-001_p1')!

    expect(zoro.verified).toBe(ZORO_PAR)
    expect(zoro.liga).toEqual({ ed: 'OP-01', num: 'OP01-001-PAR', suffix: 'PAR' })
    expect(zoro.link).toEqual({ exact: true, href: ZORO_PAR })
    expect(w.rows.find((r) => r.sourceId === 'OP01-004_p1')!.verified).toBeUndefined()
  })

  it('resume a amostra das normais por raridade', async () => {
    await recordLigaCard(
      testPrisma(),
      'OP01-001',
      'https://www.ligaonepiece.com.br/?view=cards/card&card=Roronoa%20Zoro%20(OP01-001)&ed=OP-01&num=OP01-001',
      tabela,
    )
    await recordLigaCard(
      testPrisma(),
      'OP01-004',
      'https://www.ligaonepiece.com.br/?view=cards/card&card=Usopp&ed=OP-01&num=OP01-004-X',
      tabela,
    )

    const w = await readLigaWorksheet(testPrisma(), 'OP01', tabela)
    expect(w.sample).toEqual([
      { rarity: 'L', total: 1, conferidas: 1, divergentes: [] },
      { rarity: 'R', total: 2, conferidas: 1, divergentes: ['OP01-004'] },
    ])
  })

  it('não existe para set desconhecido', async () => {
    await expect(readLigaWorksheet(testPrisma(), 'XX99', tabela)).rejects.toThrow(NotFoundError)
  })
})

describe('gravar o que foi conferido', () => {
  const lerTabela = () => JSON.parse(readFileSync(tabela, 'utf8')).cartas

  it('grava o endereço, e "não existe na Liga" como null', async () => {
    await recordLigaCard(testPrisma(), 'OP01-004_p1', null, tabela)
    await recordLigaCard(
      testPrisma(),
      'OP01-001_p2',
      'https://www.ligaonepiece.com.br/?view=cards/card&card=Z&ed=PROMO&num=P-001',
      tabela,
    )

    expect(lerTabela()).toEqual([
      { arte: 'OP01-001_p1', url: ZORO_PAR },
      { arte: 'OP01-001_p2', url: 'https://www.ligaonepiece.com.br/?view=cards/card&card=Z&ed=PROMO&num=P-001' },
      { arte: 'OP01-004_p1', url: null },
    ])
  })

  it('substitui a resposta anterior, e desfazer volta a não conferida', async () => {
    await recordLigaCard(testPrisma(), 'OP01-001_p1', null, tabela)
    expect(lerTabela()).toEqual([{ arte: 'OP01-001_p1', url: null }])

    clearLigaCard('OP01-001_p1', tabela)
    expect(lerTabela()).toEqual([])
  })

  it('recusa endereço que não é de carta da Liga, sem gravar', async () => {
    await expect(recordLigaCard(testPrisma(), 'OP01-004_p1', ligaSearchLink('OP01-004'), tabela)).rejects.toThrow(
      ValidationError,
    )
    expect(lerTabela()).toEqual([{ arte: 'OP01-001_p1', url: ZORO_PAR }])
  })

  it('recusa arte que não está no catálogo', async () => {
    await expect(recordLigaCard(testPrisma(), 'OP99-999_p1', null, tabela)).rejects.toThrow(NotFoundError)
  })

  /* A acao pode ser chamada sem a pagina: a recusa tem de estar no caso de uso. */
  it('recusa ler e gravar em produção', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    await expect(readLigaWorksheet(testPrisma(), 'OP01', tabela)).rejects.toThrow(NotFoundError)
    await expect(recordLigaCard(testPrisma(), 'OP01-004_p1', null, tabela)).rejects.toThrow(NotFoundError)
    expect(() => clearLigaCard('OP01-001_p1', tabela)).toThrow(NotFoundError)
    expect(lerTabela()).toEqual([{ arte: 'OP01-001_p1', url: ZORO_PAR }])
  })
})

/**
 * A revisão das reimpressões (`/dev/liga/revisar`).
 *
 * O arranjo do caso real: a normal `EB01-018` saiu na EB-01 e de novo na PRB-02,
 * e a paralela `EB01-018_p1`, só da PRB-02, foi conferida como `(Reprint)`. A
 * reimpressão igual é a própria normal (decisão 052), então a paralela é suspeita.
 */
describe('a revisão das reimpressões', () => {
  const REPRINT =
    'https://www.ligaonepiece.com.br/?view=cards/card&card=Mountain+God+%28Reprint%29%20(EB01-018-RE)&ed=PRB2&num=EB01-018-RE'

  beforeEach(async () => {
    const db = testPrisma()
    for (const code of ['EB-01', 'PRB-02']) await db.set.create({ data: { code, name: code } })
    const mountain = await db.card.create({ data: { code: 'EB01-018', name: 'Mountain God', type: 'Event' } })
    await arte(mountain.id, 'EB01-018', 'C', 'EB-01', 'PRB-02')
    await arte(mountain.id, 'EB01-018_p1', 'C', 'PRB-02')
    await db.variantSourceProduct.create({
      data: { cardVariantId: ids['EB01-018_p1'], source: 'tcgcsv', sourceProductId: '655984', origin: 'automatic' },
    })
    writeFileSync(
      tabela,
      JSON.stringify({
        cartas: [
          { arte: 'OP01-001_p1', url: ZORO_PAR },
          { arte: 'EB01-018_p1', url: REPRINT },
        ],
      }),
    )
  })

  it('lista a paralela conferida como reimpressão quando a normal já saiu no mesmo set', async () => {
    const rows = await readReprintReview(testPrisma(), tabela)

    expect(rows.map((r) => r.sourceId)).toEqual(['EB01-018_p1'])
    expect(rows[0]).toMatchObject({
      setCode: 'EB01',
      normalSets: expect.arrayContaining(['EB-01', 'PRB-02']),
      tcgProductId: '655984',
      liga: { ed: 'PRB2', num: 'EB01-018-RE', suffix: 'RE' },
    })
  })

  it('tira da lista quando o endereço é trocado pela versão certa', async () => {
    await recordLigaCard(
      testPrisma(),
      'EB01-018_p1',
      'https://www.ligaonepiece.com.br/?view=cards/card&card=Mountain+God+%28Pirate+Foil%29%20(EB01-018-PF)&ed=PRB2&num=EB01-018-PF',
      tabela,
    )

    expect(await readReprintReview(testPrisma(), tabela)).toEqual([])
  })

  it('"a reimpressão está certa" mantém o endereço e tira da lista', async () => {
    confirmReprint('EB01-018_p1', tabela)

    expect(await readReprintReview(testPrisma(), tabela)).toEqual([])
    const entrada = JSON.parse(readFileSync(tabela, 'utf8')).cartas.find(
      (c: { arte: string }) => c.arte === 'EB01-018_p1',
    )
    expect(entrada).toEqual({ arte: 'EB01-018_p1', url: REPRINT, nota: 'revisado: a reimpressão está certa' })
  })

  it('não confirma arte sem endereço conferido', () => {
    expect(() => confirmReprint('OP01-004_p1', tabela)).toThrow(NotFoundError)
  })

  it('recusa em produção', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await expect(readReprintReview(testPrisma(), tabela)).rejects.toThrow(NotFoundError)
    expect(() => confirmReprint('EB01-018_p1', tabela)).toThrow(NotFoundError)
  })
})
