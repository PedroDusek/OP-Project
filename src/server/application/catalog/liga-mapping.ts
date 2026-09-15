import type { PrismaClient } from '@prisma/client'
import { NotFoundError, ValidationError } from '@/server/domain/errors'
import { ligaCardLink, ligaSuffix, parseLigaUrl, type LigaLink } from '@/server/domain/catalog/liga'
import {
  isReprintSuspect,
  REPRINT_CONFIRMADA,
  validateLigaCards,
  type LigaCardEntry,
} from '@/server/domain/catalog/liga-cards'
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
    .map(({ v, setCodes, inSet }) => montarLinha(v, setCodes, inSet, tabela.get(v.sourceId!)))

  return { setCode, sets, rows, sample: normalSample(rows) }
}

interface VarianteDaLinha {
  sourceId: string | null
  variantType: string
  rarity: string | null
  imageUrl: string | null
  card: { code: string; name: string }
}

function montarLinha(
  v: VarianteDaLinha,
  setCodes: string[],
  inSet: boolean,
  entry: LigaCardEntry | undefined,
): LigaWorksheetRow {
  const verified = entry ? entry.url : undefined
  const lido = entry?.url ? parseLigaUrl(entry.url) : null
  return {
    sourceId: v.sourceId!,
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
}

export interface ReprintReviewRow extends LigaWorksheetRow {
  /** A coleção que agrupa a arte no filtro: a do código da carta (`OP09`, `ST14`, `P`). */
  setCode: string
  /** Onde a normal da mesma carta foi impressa — é o que torna a `(Reprint)` suspeita. */
  normalSets: string[]
  /** O produto do TCGplayer que hoje dá o preço desta arte, quando há vínculo. */
  tcgProductId: string | null
}

/**
 * As paralelas conferidas como `(Reprint)` que provavelmente são outra arte
 * (`isReprintSuspect`), para a tela `/dev/liga/revisar`.
 *
 * Calculada da tabela a cada visita: a arte corrigida — ou confirmada com a nota
 * `REPRINT_CONFIRMADA` — sai da lista sozinha, e o que sobra é o que falta.
 */
export async function readReprintReview(
  prisma: PrismaClient,
  path: string = LIGA_CARDS_PATH,
): Promise<ReprintReviewRow[]> {
  exigirDesenvolvimento()

  const tabela = new Map(loadLigaCards(path).map((entry) => [entry.arte, entry]))
  // No endereco o parentese vem codificado (%28Reprint%29): le-se o nome ja decodificado.
  const comReprint = [...tabela.values()].filter(
    (entry) => entry.url && /\(reprint\)/i.test(new URL(entry.url).searchParams.get('card') ?? ''),
  )
  if (comReprint.length === 0) return []

  const paralelas = await prisma.cardVariant.findMany({
    where: { variantType: 'Parallel', sourceId: { in: comReprint.map((entry) => entry.arte) } },
    select: {
      id: true,
      sourceId: true,
      variantType: true,
      rarity: true,
      imageUrl: true,
      cardId: true,
      card: { select: { code: true, name: true } },
      printings: { select: { set: { select: { code: true } } } },
      sourceProducts: { where: { source: 'tcgcsv' }, select: { sourceProductId: true } },
    },
  })
  const normais = await prisma.cardVariant.findMany({
    where: { variantType: 'Normal', cardId: { in: [...new Set(paralelas.map((p) => p.cardId))] } },
    select: { cardId: true, printings: { select: { set: { select: { code: true } } } } },
  })
  const setsDaNormal = new Map(normais.map((n) => [n.cardId, n.printings.map((p) => p.set.code)]))

  return paralelas
    .map((p) => {
      const parallelSets = p.printings.map((x) => x.set.code)
      const normalSets = setsDaNormal.get(p.cardId) ?? []
      const entry = tabela.get(p.sourceId!)
      return { p, parallelSets, normalSets, entry }
    })
    .filter(({ parallelSets, normalSets, entry }) =>
      isReprintSuspect({ url: entry?.url, nota: entry?.nota, parallelSets, normalSets }),
    )
    .map(({ p, parallelSets, normalSets, entry }) => {
      // Agrupa pela colecao do codigo da carta (OP09, ST14, P), e nao pelo set da
      // paralela: as suspeitas sao quase todas da PRB-02, e esse filtro teria dois
      // grupos. Onde a paralela saiu continua na linha, em "Impressa em".
      const setCode = p.card.code.split('-')[0]
      return {
        ...montarLinha(p, parallelSets, true, entry),
        setCode,
        normalSets,
        tcgProductId: p.sourceProducts[0]?.sourceProductId ?? null,
      }
    })
    .sort((a, b) => {
      const set = compareSetsForCatalog(a.setCode, b.setCode)
      if (set !== 0) return set
      return compareCatalogOrder(
        { cardCode: a.cardCode, sourceId: a.sourceId, setCode: a.setCode },
        { cardCode: b.cardCode, sourceId: b.sourceId, setCode: b.setCode },
      )
    })
}

/**
 * "A reimpressão está certa": mantém o endereço e grava a nota que tira a arte
 * da revisão.
 */
export function confirmReprint(sourceId: string, path: string = LIGA_CARDS_PATH): LigaCardEntry {
  exigirDesenvolvimento()
  const anteriores = loadLigaCards(path)
  const antes = anteriores.find((entry) => entry.arte === sourceId)
  if (!antes || !antes.url) throw new NotFoundError(`A arte ${sourceId} não tem endereço conferido para confirmar.`)
  const nova: LigaCardEntry = { ...antes, nota: REPRINT_CONFIRMADA }
  gravar([...anteriores.filter((entry) => entry.arte !== sourceId), nova], path)
  return nova
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
