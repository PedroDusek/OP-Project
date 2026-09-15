import { prisma } from '@/server/infrastructure/prisma'
import { bundledLigaCards } from '@/server/infrastructure/catalog/liga-cards-file'
import { ligaLookup } from '@/server/domain/catalog/liga-cards'
import { getCardVariant as getCardVariantWith } from './get-card-variant'
import {
  readLigaWorksheet as readLigaWorksheetWith,
  readReprintReview as readReprintReviewWith,
  readDuplicateReview as readDuplicateReviewWith,
  recordLigaCard as recordLigaCardWith,
} from './liga-mapping'
import { searchCatalog as searchCatalogWith, type CatalogQuery } from './search-cards'
import { listSets as listSetsWith, getSet as getSetWith } from './list-sets'
import { getCatalogVocabulary as getCatalogVocabularyWith } from './vocabulary'

/**
 * Ponto de composicao dos casos de uso do catalogo.
 *
 * Camada: application, a unica que pode falar com infrastructure.
 *
 * As rotas chamam daqui em vez de receber um cliente Prisma, porque `app/` nao
 * pode importar persistencia. Os casos de uso continuam recebendo o cliente por
 * parametro, o que mantem cada um testavel contra o banco de teste sem passar
 * por este modulo.
 */

export function searchCatalog(query: CatalogQuery = {}) {
  return searchCatalogWith(prisma, query)
}

/*
 * A tabela da Liga e conferida uma vez, na primeira carta aberta, e nao a cada
 * visita: ela so muda com um deploy.
 */
let ligaCards: ReadonlyMap<string, string | null> | undefined

export function getCardVariant(variantId: bigint) {
  ligaCards ??= ligaLookup(bundledLigaCards())
  return getCardVariantWith(prisma, variantId, ligaCards)
}

/** A conferencia da Liga, fora de producao (decisao 071). */
export function readLigaWorksheet(setCode: string) {
  return readLigaWorksheetWith(prisma, setCode)
}

export function recordLigaCard(sourceId: string, url: string | null) {
  return recordLigaCardWith(prisma, sourceId, url)
}

export function readReprintReview() {
  return readReprintReviewWith(prisma)
}

export function readDuplicateReview() {
  return readDuplicateReviewWith(prisma)
}

export { clearLigaCard, confirmReprint, confirmSameIdentity, ligaMappingAvailable } from './liga-mapping'
export type {
  DuplicateReviewRow,
  LigaWorksheet,
  LigaWorksheetRow,
  NormalSample,
  ReprintReviewRow,
} from './liga-mapping'

export function listSets() {
  return listSetsWith(prisma)
}

export function getSet(code: string) {
  return getSetWith(prisma, code)
}

export function getCatalogVocabulary() {
  return getCatalogVocabularyWith(prisma)
}
