import { prisma } from '@/server/infrastructure/prisma'
import { TcgCsvPriceProvider } from '@/server/infrastructure/prices/tcgcsv-price-provider'
import {
  importPrices as importPricesWith,
  type ImportPricesOptions,
} from './import-prices'
import { getMarketPrice as getMarketPriceWith } from './read-prices'

/**
 * Ponto de composicao dos casos de uso de preco.
 *
 * Camada: application, a unica que pode falar com infrastructure.
 */

export function getMarketPrice(cardVariantId: bigint) {
  return getMarketPriceWith(prisma, cardVariantId)
}

export function importPrices(options: ImportPricesOptions = {}) {
  return importPricesWith(prisma, new TcgCsvPriceProvider(), options)
}

export type { ImportPricesResult, ImportPricesOptions } from './import-prices'
export type { MarketPrice } from './read-prices'
