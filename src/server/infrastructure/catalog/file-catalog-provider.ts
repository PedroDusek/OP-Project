import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCardList } from '@/server/domain/catalog/parse-card-list'
import type { CatalogPage, CatalogProvider } from '@/server/domain/catalog/types'

/**
 * Provedor que le um snapshot local em vez de ir a fonte.
 *
 * Camada: infrastructure.
 *
 * Existe por causa da decisao 020. Rebaixar o catalogo inteiro toda vez que ele
 * precisa ir para outro banco e carga evitavel sobre a origem: uma vez que as
 * paginas estao salvas, importar delas da o mesmo resultado sem tocar a fonte.
 *
 * O snapshot fica **fora do repositorio**. Sao megabytes de HTML da Bandai, e
 * versiona-los seria redistribuir o conteudo deles, justamente o que a decisao
 * 020 evita. Ele e material de trabalho local, nao artefato do projeto.
 *
 * Use `BandaiCatalogProvider` para criar ou atualizar um snapshot; use este para
 * qualquer importacao subsequente a partir dele.
 */
export class FileCatalogProvider implements CatalogProvider {
  readonly name = 'bandai'

  constructor(private readonly directory: string) {}

  async listSeriesIds(): Promise<string[]> {
    const files = readdirSync(this.directory).filter((f) => f.endsWith('.html'))
    if (files.length === 0) {
      throw new Error(`Nenhum arquivo .html em ${this.directory}. O snapshot esta vazio?`)
    }
    return files.map((f) => f.replace(/\.html$/, '')).sort()
  }

  async fetchSeries(seriesId: string): Promise<CatalogPage> {
    // O id vem de um argumento de linha de comando e vira caminho de arquivo:
    // restringir a digitos impede sair do diretorio do snapshot.
    if (!/^\d+$/.test(seriesId)) {
      throw new Error(`identificador de serie invalido: ${seriesId}`)
    }
    const path = join(this.directory, `${seriesId}.html`)
    return parseCardList(readFileSync(path, 'utf8'))
  }
}
