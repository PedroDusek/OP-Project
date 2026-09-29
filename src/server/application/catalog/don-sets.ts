import type { PrismaClient } from '@prisma/client'
import { DON_SET_CODE } from '@/server/domain/catalog/don'
import { validateDonSets, type DonSetEntry } from '@/server/domain/catalog/don-sets'
import { compareSetsForCatalog, displaySetCode, displaySetName } from '@/server/domain/catalog/sets'
import { DON_TYPE } from '@/server/domain/catalog/types'
import { NotFoundError, ValidationError } from '@/server/domain/errors'
import {
  DON_SETS_PATH,
  loadDonSets,
  saveDonSets,
} from '@/server/infrastructure/catalog/don-sets-file'

/**
 * Em que coleção cada DON!! saiu (decisão 112).
 *
 * Camada: application.
 *
 * Os DON!! são lançados junto das coleções, e o dono do produto quer vê-los
 * nelas. O tcgcsv não diz qual é — os grupos de lá não são os nossos sets —,
 * então quem diz é gente, uma carta por vez.
 *
 * ## Só fora de produção
 *
 * Grava `data/don-sets.json`, um arquivo do repositório. A recusa está aqui, e
 * não só na tela, porque a ação pode ser chamada sem ela — é a mesma guarda da
 * conferência da Liga.
 */

export function donSetsAvailable(): boolean {
  return process.env.NODE_ENV !== 'production'
}

function exigirDesenvolvimento(): void {
  if (!donSetsAvailable()) {
    throw new ValidationError('A tabela de sets do DON!! só existe fora de produção.')
  }
}

export interface DonSetOption {
  code: string
  displayCode: string
  displayName: string
}

export interface DonSetRow {
  /** O `source_id` da arte: o `productId` do TCGplayer. */
  arte: string
  cardCode: string
  cardName: string
  variantType: string
  rarity: string | null
  imageUrl: string | null
  /** Os sets escolhidos à mão, sem o set artificial `DON`. */
  sets: string[]
}

export interface DonSetsWorksheet {
  rows: DonSetRow[]
  /** As coleções que se pode escolher. O set artificial `DON` fica de fora. */
  sets: DonSetOption[]
  /** Quantas artes ainda não têm coleção informada. */
  faltam: number
}

export async function readDonSetsWorksheet(
  prisma: PrismaClient,
  path: string = DON_SETS_PATH,
): Promise<DonSetsWorksheet> {
  exigirDesenvolvimento()

  const tabela = new Map(loadDonSets(path).map((entry) => [entry.arte, entry.sets]))

  const variantes = await prisma.cardVariant.findMany({
    where: { card: { type: DON_TYPE }, sourceId: { not: null } },
    select: {
      sourceId: true,
      variantType: true,
      rarity: true,
      imageUrl: true,
      card: { select: { code: true, name: true } },
    },
    orderBy: [{ card: { name: 'asc' } }, { id: 'asc' }],
  })

  const rows = variantes.map((v): DonSetRow => ({
    arte: v.sourceId!,
    cardCode: v.card.code,
    cardName: v.card.name,
    variantType: v.variantType,
    rarity: v.rarity,
    imageUrl: v.imageUrl,
    sets: tabela.get(v.sourceId!) ?? [],
  }))

  /*
   * O set artificial `DON` nao e escolha: toda arte ja esta nele, e oferece-lo
   * faria parecer que da para tira-la de la.
   */
  const sets = (await prisma.set.findMany({ select: { code: true, name: true } }))
    .filter((set) => set.code !== DON_SET_CODE)
    .sort((a, b) => compareSetsForCatalog(a.code, b.code))
    .map((set) => ({
      code: set.code,
      displayCode: displaySetCode(set.code),
      displayName: displaySetName(set.name),
    }))

  return { rows, sets, faltam: rows.filter((row) => row.sets.length === 0).length }
}

/**
 * Grava em que sets uma arte saiu.
 *
 * Lista vazia **apaga** a linha da tabela, e isso e o "nao sei" de volta — nao
 * um vinculo com nada. O caso de uso nao mexe no banco: quem aplica a tabela e
 * `applyDonSets`, na importacao, e assim o arquivo continua sendo a verdade.
 */
export async function recordDonSets(
  prisma: PrismaClient,
  arte: string,
  setCodes: readonly string[],
  path: string = DON_SETS_PATH,
): Promise<void> {
  exigirDesenvolvimento()

  const chave = arte.trim()
  if (chave === '') throw new ValidationError('Arte não informada.')

  const existe = await prisma.cardVariant.findFirst({
    where: { sourceId: chave, card: { type: DON_TYPE } },
    select: { id: true },
  })
  if (!existe) throw new NotFoundError(`A arte ${chave} não é um DON!! do catálogo.`)

  const pedidos = [...new Set(setCodes.map((code) => code.trim()).filter((code) => code !== ''))]

  if (pedidos.includes(DON_SET_CODE)) {
    throw new ValidationError('O set DON é automático: toda arte já está nele.')
  }

  const conhecidos = await prisma.set.findMany({
    where: { code: { in: pedidos } },
    select: { code: true },
  })
  const faltando = pedidos.filter((code) => !conhecidos.some((set) => set.code === code))
  if (faltando.length > 0) {
    throw new ValidationError(`Set não encontrado: ${faltando.join(', ')}.`)
  }

  const tabela = loadDonSets(path).filter((entry) => entry.arte !== chave)
  const proxima: DonSetEntry[] = pedidos.length > 0 ? [...tabela, { arte: chave, sets: pedidos }] : tabela

  saveDonSets(validateDonSets(proxima), path)
}

export interface ApplyDonSetsResult {
  entries: number
  printings: number
  /** Artes da tabela que nao existem no catalogo — tabela adiante do banco. */
  unknownArts: string[]
  /** Sets da tabela que nao existem no catalogo. */
  unknownSets: string[]
}

/**
 * Aplica a tabela ao banco: cada arte ganha a impressao na colecao informada.
 *
 * Roda depois da importacao dos DON!!, e nao dentro do provedor: o provedor e
 * infraestrutura sem banco, e resolver codigo de set exige o banco.
 *
 * **Nao apaga impressao nenhuma.** Uma arte que sai da tabela continua com a
 * impressao que ganhou — tirar exigiria decidir o que fazer com a colecao de
 * quem ja a via ali, e isso e conversa, nao efeito colateral de importacao.
 */
export async function applyDonSets(
  prisma: PrismaClient,
  path: string = DON_SETS_PATH,
): Promise<ApplyDonSetsResult> {
  const tabela = loadDonSets(path)
  const result: ApplyDonSetsResult = { entries: tabela.length, printings: 0, unknownArts: [], unknownSets: [] }
  if (tabela.length === 0) return result

  const variantes = await prisma.cardVariant.findMany({
    where: { card: { type: DON_TYPE }, sourceId: { in: tabela.map((entry) => entry.arte) } },
    select: { id: true, sourceId: true },
  })
  const idPorArte = new Map(variantes.map((v) => [v.sourceId!, v.id]))

  const sets = await prisma.set.findMany({ select: { id: true, code: true } })
  const idPorSet = new Map(sets.map((set) => [set.code, set.id]))

  for (const entry of tabela) {
    const cardVariantId = idPorArte.get(entry.arte)
    if (cardVariantId === undefined) {
      result.unknownArts.push(entry.arte)
      continue
    }

    for (const code of entry.sets) {
      const setId = idPorSet.get(code)
      if (setId === undefined) {
        if (!result.unknownSets.includes(code)) result.unknownSets.push(code)
        continue
      }

      await prisma.variantPrinting.upsert({
        where: { cardVariantId_setId: { cardVariantId, setId } },
        create: { cardVariantId, setId },
        update: {},
      })
      result.printings += 1
    }
  }

  return result
}
