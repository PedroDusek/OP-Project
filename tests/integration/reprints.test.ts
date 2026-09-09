import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { importCatalog } from '@/server/application/catalog/import-catalog'
import { parseCardList } from '@/server/domain/catalog/parse-card-list'
import type { CatalogPage, CatalogProvider } from '@/server/domain/catalog/types'
import { disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * A reimpressao virando impressao, contra o banco.
 *
 * O parser so separa os dois sufixos; quem junta a reimpressao a arte que ela
 * reimprime e o importador, e so ele pode — a arte costuma estar em outra
 * pagina, publicada por outra serie (decisao 052).
 *
 * O que se protege aqui e justamente isso: que a ordem em que a fonte lista as
 * series nao mude o resultado. Foi por depender dessa ordem que a primeira
 * versao perdia o set.
 */

const silent = { info: () => {}, warn: () => {}, error: () => {} }

function entrada(sourceId: string, code: string, sets: string): string {
  return `
    <dl class="modalCol" id="${sourceId}">
      <dt>
        <div class="infoCol"><span>${code}</span> | <span>SR</span> | <span>CHARACTER</span></div>
        <div class="cardName">Cavendish</div>
      </dt>
      <dd>
        <div class="backCol">
          <div class="cost"><h3>Cost</h3>4</div>
          <div class="power"><h3>Power</h3>5000</div>
          <div class="counter"><h3>Counter</h3>-</div>
          <div class="color"><h3>Color</h3>Green</div>
          <div class="feature"><h3>Type</h3>Teste</div>
          <div class="text"><h3>Effect</h3>-</div>
          <div class="getInfo"><h3>Card Set(s)</h3>${sets}</div>
        </div>
      </dd>
    </dl>`
}

const PAGINA_ORIGEM = () =>
  parseCardList(
    entrada('EB01-012', 'EB01-012', 'Extra Booster [EB-01]') +
      entrada('EB01-012_p1', 'EB01-012', 'Extra Booster [EB-01]'),
  )

const PAGINA_REIMPRESSAO = () =>
  parseCardList(entrada('EB01-012_r1', 'EB01-012', 'Premium Booster [PRB-02]'))

/** Provedor de teste que devolve as paginas na ordem pedida. */
function provider(pages: Record<string, CatalogPage>): CatalogProvider {
  return {
    name: 'bandai',
    listSeriesIds: async () => Object.keys(pages),
    fetchSeries: async (id: string) => pages[id],
  }
}

async function setsDaVariante(sourceId: string): Promise<string[]> {
  const v = await testPrisma().cardVariant.findFirst({
    where: { sourceId },
    select: { printings: { select: { set: { select: { code: true } } } } },
  })
  return (v?.printings ?? []).map((p) => p.set.code).sort()
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})

describe('a reimpressao vira set da arte comum', () => {
  it('nao cria variante para ela', async () => {
    await importCatalog(
      testPrisma(),
      provider({ origem: PAGINA_ORIGEM(), reimpressao: PAGINA_REIMPRESSAO() }),
      { logger: silent },
    )

    const ids = await testPrisma().cardVariant.findMany({ select: { sourceId: true } })
    expect(ids.map((v) => v.sourceId).sort()).toEqual(['EB01-012', 'EB01-012_p1'])
  })

  it('acrescenta o set na arte comum, e nao na paralela', async () => {
    await importCatalog(
      testPrisma(),
      provider({ origem: PAGINA_ORIGEM(), reimpressao: PAGINA_REIMPRESSAO() }),
      { logger: silent },
    )

    expect(await setsDaVariante('EB01-012')).toEqual(['EB-01', 'PRB-02'])
    expect(await setsDaVariante('EB01-012_p1')).toEqual(['EB-01'])
  })

  /**
   * O motivo de a aplicacao das reimpressoes ficar para o fim. Com a serie da
   * reimpressao vindo primeiro, gravar na hora perderia o set: a arte comum
   * ainda nao existe.
   */
  it('funciona com a reimpressao chegando antes da arte', async () => {
    await importCatalog(
      testPrisma(),
      provider({ reimpressao: PAGINA_REIMPRESSAO(), origem: PAGINA_ORIGEM() }),
      { logger: silent },
    )

    expect(await setsDaVariante('EB01-012')).toEqual(['EB-01', 'PRB-02'])
  })

  it('conta as impressoes gravadas no relatorio', async () => {
    const report = await importCatalog(
      testPrisma(),
      provider({ origem: PAGINA_ORIGEM(), reimpressao: PAGINA_REIMPRESSAO() }),
      { logger: silent },
    )

    expect(report.reprintPrintings).toBe(1)
    expect(report.reprintsWithoutBase).toEqual([])
  })
})

describe('repetir a importacao', () => {
  /** A chave composta de `variant_printings` e o que torna isto idempotente. */
  it('nao acrescenta impressao na segunda passada', async () => {
    const pages = { origem: PAGINA_ORIGEM(), reimpressao: PAGINA_REIMPRESSAO() }

    await importCatalog(testPrisma(), provider(pages), { logger: silent })
    await importCatalog(testPrisma(), provider(pages), { logger: silent })

    expect(await setsDaVariante('EB01-012')).toEqual(['EB-01', 'PRB-02'])
    expect(await testPrisma().variantPrinting.count()).toBe(3)
  })
})

describe('reimpressao sem a arte correspondente', () => {
  /**
   * Nao deveria acontecer: a fonte publica a arte comum antes de reimprimi-la.
   * Se acontecer, some do banco — entao aparece no relatorio, porque descarte
   * silencioso ja custou 538 variantes uma vez (armadilha 5).
   */
  it('fica no relatorio em vez de sumir', async () => {
    const report = await importCatalog(
      testPrisma(),
      provider({ reimpressao: PAGINA_REIMPRESSAO() }),
      { logger: silent },
    )

    expect(report.reprintPrintings).toBe(0)
    expect(report.reprintsWithoutBase).toEqual(['EB01-012_r1'])
  })
})
