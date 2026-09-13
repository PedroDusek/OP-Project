import type { PrismaClient } from '@prisma/client'
import { NotFoundError, ValidationError } from '@/server/domain/errors'
import { ligaCardLink, ligaSuffix, parseLigaUrl, type LigaLink } from '@/server/domain/catalog/liga'
import { validateLigaCards, type LigaCardEntry } from '@/server/domain/catalog/liga-cards'
import { compareCatalogOrder, isOwnSet, placementSet } from '@/server/domain/catalog/order'
import { compareSetsForCatalog } from '@/server/domain/catalog/sets'
import { LIGA_CARDS_PATH, loadLigaCards, saveLigaCards } from '@/server/infrastructure/catalog/liga-cards-file'

/**
 * A conferência das páginas da Liga, coleção a coleção, vista pela tela
 * `/dev/liga` (decisão 071).
 *
 * Camada: application. Lê o catálogo e a tabela, e grava na tabela o endereço
 * que a pessoa conferiu na Liga. O banco não é tocado: a tabela é um arquivo do
 * repositório, e chega a produção pelo PR que a leva.
 *
 * ## Só existe fora de produção
 *
 * Pelo mesmo motivo da tela de paralelas (decisão 068): grava um arquivo do
 * repositório. A recusa está aqui, porque a ação pode ser chamada sem a página.
 */

export function ligaMappingAvailable(): boolean {
  return process.env.NODE_ENV !== 'production'
}

function exigirDesenvolvimento(): void {
  if (!ligaMappingAvailable()) {
    throw new NotFoundError('A conferência da Liga só existe fora de produção.')
  }
}

export interface LigaWorksheetRow {
  sourceId: string
  cardCode: string
  cardName: string
  variantType: string
  rarity: string | null
  imageUrl: string | null
  setCodes: string[]
  /**
   * `true` para a arte impressa na coleção. `false` para a que tem o código da
   * coleção e só existe em outro produto — a `OP01-004_p1`, da PROMO. Ela entra
   * na planilha porque é onde o link errava.
   */
  inSet: boolean
  /** A tabela: o endereço, `null` para "não existe na Liga", `undefined` se não conferida. */
  verified: string | null | undefined
  nota?: string
  /** O que o app mostra hoje para esta arte. */
  link: LigaLink
  /** O que se lê do endereço conferido. `suffix` nulo: o `num` não começa pelo código da carta. */
  liga: { ed: string; num: string; suffix: string | null } | null
}

/** A amostra das normais de uma raridade: a regra da normal vale se nenhuma divergir. */
export interface NormalSample {
  rarity: string
  total: number
  conferidas: number
  /** Normais conferidas cujo código na Liga não é o da carta sem sufixo. */
  divergentes: string[]
}

export interface LigaWorksheet {
  setCode: string
  sets: { code: string; name: string }[]
  rows: LigaWorksheetRow[]
  sample: NormalSample[]
}

/** A ordem das raridades na amostra, e na tela. */
const RARITY_ORDER = ['L', 'C', 'UC', 'R', 'SR', 'SEC', 'SP CARD', 'TR', 'P']

export async function readLigaWorksheet(
  prisma: PrismaClient,
  setCode: string,
  path: string = LIGA_CARDS_PATH,
): Promise<LigaWorksheet> {
  exigirDesenvolvimento()

  const sets = (await prisma.set.findMany({ select: { code: true, name: true } })).sort((a, b) =>
    compareSetsForCatalog(a.code, b.code),
  )
  if (!sets.some((set) => set.code === setCode)) throw new NotFoundError(`O set ${setCode} não existe.`)

  const tabela = new Map(loadLigaCards(path).map((entry) => [entry.arte, entry]))

  // As impressas na colecao, e as que tem o codigo dela e sairam em outro
  // produto. O prefixo so estreita a consulta; quem decide e `isOwnSet`.
  const prefixos = [...new Set((setCode.toUpperCase().replace(/[^A-Z0-9]/g, '').match(/[A-Z]+\d+/g) ?? []))].map(
    (token) => {
      const [, letras, numero] = /^([A-Z]+)(\d+)$/.exec(token)!
      return `${letras}${numero.padStart(2, '0')}-`
    },
  )
  const variantes = await prisma.cardVariant.findMany({
    where: {
      sourceId: { not: null },
      OR: [
        { printings: { some: { set: { code: setCode } } } },
        ...prefixos.map((prefixo) => ({ card: { code: { startsWith: prefixo } } })),
      ],
    },
    select: {
      id: true,
      sourceId: true,
      variantType: true,
      rarity: true,
      imageUrl: true,
      card: { select: { code: true, name: true } },
      printings: { select: { set: { select: { code: true } } } },
    },
  })

  const rows = variantes
    .map((v) => {
      const setCodes = v.printings.map((p) => p.set.code)
      return { v, setCodes, inSet: setCodes.includes(setCode) }
    })
    .filter(({ v, inSet }) => inSet || isOwnSet(v.card.code, setCode))
    .sort((a, b) => {
      // As impressas na colecao primeiro; dentro de cada grupo, a ordem do catalogo.
      if (a.inSet !== b.inSet) return a.inSet ? -1 : 1
      const chave = (x: typeof a) => ({
        cardCode: x.v.card.code,
        sourceId: x.v.sourceId,
        setCode: placementSet(x.v.card.code, x.setCodes, setCode),
      })
      return compareCatalogOrder(chave(a), chave(b)) || (a.v.id < b.v.id ? -1 : 1)
    })
    .map(({ v, setCodes, inSet }): LigaWorksheetRow => {
      const sourceId = v.sourceId!
      const entry = tabela.get(sourceId)
      const verified = entry ? entry.url : undefined
      const lido = entry?.url ? parseLigaUrl(entry.url) : null
      return {
        sourceId,
        cardCode: v.card.code,
        cardName: v.card.name,
        variantType: v.variantType,
        rarity: v.rarity,
        imageUrl: v.imageUrl,
        setCodes,
        inSet,
        verified,
        ...(entry?.nota ? { nota: entry.nota } : {}),
        link: ligaCardLink({ cardCode: v.card.code, cardName: v.card.name, variantType: v.variantType, verified }),
        liga:
          lido && !('error' in lido)
            ? { ed: lido.ed, num: lido.num, suffix: ligaSuffix(lido.num, v.card.code) }
            : null,
      }
    })

  return { setCode, sets, rows, sample: normalSample(rows) }
}

function normalSample(rows: readonly LigaWorksheetRow[]): NormalSample[] {
  const porRaridade = new Map<string, NormalSample>()
  for (const row of rows) {
    if (!row.inSet || row.variantType !== 'Normal') continue
    const rarity = row.rarity ?? '—'
    const amostra = porRaridade.get(rarity) ?? { rarity, total: 0, conferidas: 0, divergentes: [] }
    amostra.total++
    if (row.verified) {
      amostra.conferidas++
      if (row.liga?.suffix !== '') amostra.divergentes.push(row.sourceId)
    }
    porRaridade.set(rarity, amostra)
  }
  const posicao = (rarity: string) => {
    const i = RARITY_ORDER.indexOf(rarity)
    return i === -1 ? RARITY_ORDER.length : i
  }
  return [...porRaridade.values()].sort((a, b) => posicao(a.rarity) - posicao(b.rarity))
}

/**
 * Grava o que a pessoa conferiu para uma arte: o endereço da Liga, ou `null` para
 * "a Liga não tem página para esta arte". Substitui a resposta anterior.
 *
 * Confere que a arte existe no catálogo e que o endereço tem a forma de uma
 * página de carta da Liga. **Não** confere que é a arte certa: isso só quem abriu
 * a página sabe.
 */
export async function recordLigaCard(
  prisma: PrismaClient,
  sourceId: string,
  url: string | null,
  path: string = LIGA_CARDS_PATH,
): Promise<LigaCardEntry> {
  exigirDesenvolvimento()

  const arte = await prisma.cardVariant.findFirst({ where: { sourceId }, select: { id: true } })
  if (!arte) throw new NotFoundError(`A arte ${sourceId} não está no catálogo.`)

  let endereco: string | null = null
  if (url !== null) {
    const lido = parseLigaUrl(url)
    if ('error' in lido) throw new ValidationError(lido.error, { url: [lido.error] })
    endereco = lido.url
  }

  const anteriores = loadLigaCards(path)
  const antes = anteriores.find((entry) => entry.arte === sourceId)
  // A nota explica a resposta; mudando a resposta, ela deixa de valer.
  const nota = antes && antes.url === endereco ? antes.nota : undefined
  const nova: LigaCardEntry = { arte: sourceId, url: endereco, ...(nota ? { nota } : {}) }

  gravar([...anteriores.filter((entry) => entry.arte !== sourceId), nova], path)
  return nova
}

/** Tira a arte da tabela: ela volta a "não conferida". */
export function clearLigaCard(sourceId: string, path: string = LIGA_CARDS_PATH): void {
  exigirDesenvolvimento()
  const anteriores = loadLigaCards(path)
  if (!anteriores.some((entry) => entry.arte === sourceId)) return
  gravar(
    anteriores.filter((entry) => entry.arte !== sourceId),
    path,
  )
}

function gravar(entries: LigaCardEntry[], path: string): void {
  try {
    validateLigaCards(entries)
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : String(error))
  }
  saveLigaCards(entries, path)
}
