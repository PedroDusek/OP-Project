/**
 * A arte da carta guardada por nós (decisão 113, que muda a 020).
 *
 * Camada: domain. Puro: só monta e lê texto.
 *
 * ## Por que deixamos de referenciar a origem
 *
 * A decisão 020 combinou referenciar a imagem na Bandai e nunca copiá-la, e a
 * 038 pôs isso passando pelo nosso otimizador porque o navegador recusa desenhar
 * a imagem vinda direto de lá.
 *
 * Em 25/09 a Bandai passou a estrangular o endereço da Fly. Medido nos dois
 * lados, com os mesmos arquivos no mesmo instante: **2,1 s daqui, 27 a 30 s de
 * lá**, quando não estoura. E o Next desiste antes: o tempo limite de buscar a
 * imagem na origem é `AbortSignal.timeout(7000)`, **escrito fixo no código
 * dele**, sem configuração.
 *
 * Com isso, toda arte fora do cache virou imagem quebrada na tela — e não havia
 * ajuste possível do nosso lado, porque o limite não é nosso.
 *
 * ## O nome do arquivo sai do `source_id`
 *
 * E não do código da carta: uma carta tem várias artes, e é a arte que tem
 * imagem própria. `OP01-016_p3` é um arquivo; `OP01-016` é outro. O `source_id`
 * já é o identificador por arte desde a decisão 019.
 *
 * Só letras, números, `-` e `_` entram no nome — é o que a fonte usa, e recusar
 * o resto impede que um identificador estranho vire caminho de arquivo.
 */

/** A pasta pública que serve as artes guardadas. */
export const STORED_IMAGE_ROUTE = '/imagens/cartas'

const NOME_VALIDO = /^[A-Za-z0-9_-]+$/

/** `OP01-016_p3` → `OP01-016_p3.webp`. `null` quando o identificador não serve. */
export function storedImageFile(sourceId: string | null): string | null {
  const id = sourceId?.trim() ?? ''
  if (id === '' || !NOME_VALIDO.test(id)) return null
  return `${id}.webp`
}

/** O endereço que a tela usa. `null` quando não há arte guardada para esta. */
export function storedImageUrl(sourceId: string | null): string | null {
  const file = storedImageFile(sourceId)
  return file === null ? null : `${STORED_IMAGE_ROUTE}/${file}`
}

/** O `source_id` de volta, a partir do nome do arquivo que a rota recebeu. */
export function sourceIdFromFile(file: string): string | null {
  const nome = file.trim()
  if (!nome.endsWith('.webp')) return null
  const id = nome.slice(0, -'.webp'.length)
  return NOME_VALIDO.test(id) ? id : null
}

/**
 * A arte guardada que corresponde a um endereço de origem.
 *
 * Existe para a troca acontecer **num lugar só**. O `source_id` já está dentro
 * do endereço das duas origens que temos, então dá para chegar nele sem mudar
 * dezenas de pontos que hoje passam `imageUrl` adiante:
 *
 *   - Bandai: `.../cardlist/card/OP01-016_p3.png` → `OP01-016_p3`
 *   - TCGplayer (DON!!): `.../product/482236_200w.jpg` → `482236`
 *
 * `null` para endereço que não reconhecemos — e aí quem chama segue com o
 * original. É o que faz a troca ser reversível: nada some, só deixa de ser
 * pedido.
 */
export function storedImageFromOrigin(originUrl: string | null): string | null {
  const url = originUrl?.trim() ?? ''
  if (url === '') return null

  // Ja e nosso: nao mexe.
  if (url.startsWith(STORED_IMAGE_ROUTE)) return url

  const tcg = /\/product\/(\d+)_\d+w\.\w+$/.exec(url)
  if (tcg) return storedImageUrl(tcg[1])

  const bandai = /\/cardlist\/card\/([^/?#]+)\.\w+$/.exec(url)
  if (bandai) return storedImageUrl(bandai[1])

  return null
}
