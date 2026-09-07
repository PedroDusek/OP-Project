import type { PrismaClient } from '@prisma/client'
import { NotFoundError } from '@/server/domain/errors'
import {
  compareSetsByRelease,
  displaySetName,
  setKind,
  type SetKind,
} from '@/server/domain/catalog/sets'

/**
 * Sets do catalogo.
 *
 * Camada: application.
 *
 * A contagem vem de `variant_printings`, nunca do prefixo do codigo — e a mesma
 * regra que o progresso por set segue (`business-rules.md` 2.2), e a razao de
 * `OP14-EB04` existir: uma variante pode ser impressa em mais de um set.
 *
 * Sao 60 sets. Buscar todos e ordenar em memoria custa menos que ensinar a
 * ordem de lancamento ao SQL, e mantem a regra num lugar so, testavel sem banco.
 */

export interface SetSummary {
  code: string
  /** Nome como a fonte publicou. */
  name: string
  /** Nome sem os hifens decorativos, para exibir. */
  displayName: string
  /** Variantes impressas neste set. Exibido como "cartas". */
  variantCount: number
  kind: SetKind
  /**
   * Arte para o cabecalho: a primeira carta do set, por codigo.
   *
   * O modelo nao guarda capa de set — a fonte nao publica uma que a importacao
   * alcance. A primeira carta e deterministica e pertence ao set, que e o mais
   * proximo de "a imagem da colecao" que o dado permite hoje.
   */
  coverUrl: string | null
}

interface SetRow {
  code: string
  name: string
  variant_count: number
  cover_url: string | null
}

/**
 * Uma consulta so, com a capa resolvida no banco.
 *
 * A alternativa — buscar os sets e depois uma carta por set — sao 61 idas ao
 * banco para montar uma lista de 60 linhas, o N+1 classico.
 */
const SETS_QUERY = `
  select
    s.code,
    s.name,
    count(distinct vp.card_variant_id)::int as variant_count,
    (
      select cv.image_url
      from variant_printings vp2
      join card_variants cv on cv.id = vp2.card_variant_id
      join cards c on c.id = cv.card_id
      where vp2.set_id = s.id and cv.image_url is not null
      order by c.code asc, cv.id asc
      limit 1
    ) as cover_url
  from sets s
  left join variant_printings vp on vp.set_id = s.id
  group by s.id, s.code, s.name
`

function toSummary(row: SetRow): SetSummary {
  return {
    code: row.code,
    name: row.name,
    displayName: displaySetName(row.name),
    variantCount: row.variant_count,
    kind: setKind(row.code),
    coverUrl: row.cover_url,
  }
}

export async function listSets(prisma: PrismaClient): Promise<SetSummary[]> {
  const rows = await prisma.$queryRawUnsafe<SetRow[]>(SETS_QUERY)

  return rows.map(toSummary).sort((a, b) => compareSetsByRelease(a.code, b.code))
}

export async function getSet(prisma: PrismaClient, code: string): Promise<SetSummary> {
  const rows = await prisma.$queryRawUnsafe<SetRow[]>(
    `${SETS_QUERY} having s.code = $1`,
    code,
  )

  const row = rows[0]
  if (!row) throw new NotFoundError('Set nao encontrado.')

  return toSummary(row)
}
