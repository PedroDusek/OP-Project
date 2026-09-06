import { prisma } from '@/server/infrastructure/prisma'
import { getCardVariant as getCardVariantWith } from './get-card-variant'
import { searchCatalog as searchCatalogWith, type CatalogQuery } from './search-cards'

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

export function getCardVariant(variantId: bigint) {
  return getCardVariantWith(prisma, variantId)
}
