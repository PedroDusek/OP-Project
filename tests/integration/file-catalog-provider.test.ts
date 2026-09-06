import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FileCatalogProvider } from '@/server/infrastructure/catalog/file-catalog-provider'

/**
 * O provedor de snapshot existe para nao rebaixar o catalogo a cada importacao
 * (decisao 020). O que se verifica aqui e que ele produz o mesmo resultado que a
 * fonte, sem tocar a rede.
 */

const fixture = readFileSync(
  fileURLToPath(new URL('../fixtures/bandai-cardlist-sample.html', import.meta.url)),
  'utf8',
)

let dir: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'optcg-snapshot-'))
  writeFileSync(join(dir, '569117.html'), fixture, 'utf8')
  writeFileSync(join(dir, '569116.html'), fixture, 'utf8')
  // Arquivo que nao e serie: deve ser ignorado, nao virar um id.
  writeFileSync(join(dir, 'leiame.txt'), 'nao sou uma serie', 'utf8')
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('provedor de catalogo a partir de snapshot', () => {
  it('lista apenas os arquivos de serie, ordenados', async () => {
    const provider = new FileCatalogProvider(dir)
    expect(await provider.listSeriesIds()).toEqual(['569116', '569117'])
  })

  it('produz o mesmo resultado que o parser da fonte', async () => {
    const provider = new FileCatalogProvider(dir)
    const page = await provider.fetchSeries('569117')

    expect(page.rejected).toEqual([])
    expect(page.variants).toHaveLength(6)
    expect(page.variants.map((v) => v.sourceId)).toContain('OP17-005_p1')
  })

  it('recusa identificador que sairia do diretorio do snapshot', async () => {
    // O id vem da linha de comando e vira caminho de arquivo.
    const provider = new FileCatalogProvider(dir)
    await expect(provider.fetchSeries('../../etc/passwd')).rejects.toThrow('invalido')
    await expect(provider.fetchSeries('569117/../../x')).rejects.toThrow('invalido')
  })

  it('avisa quando o diretorio nao tem snapshot nenhum', async () => {
    const vazio = mkdtempSync(join(tmpdir(), 'optcg-vazio-'))
    try {
      const provider = new FileCatalogProvider(vazio)
      await expect(provider.listSeriesIds()).rejects.toThrow('snapshot')
    } finally {
      rmSync(vazio, { recursive: true, force: true })
    }
  })
})
