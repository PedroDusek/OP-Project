import { prisma } from '@/server/infrastructure/prisma'
import { TcgCsvPriceProvider } from '@/server/infrastructure/prices/tcgcsv-price-provider'
import { BcbPtaxProvider } from '@/server/infrastructure/prices/bcb-ptax-provider'
import {
  importPrices as importPricesWith,
  type ImportPricesOptions,
} from './import-prices'
import {
  importExchangeRate as importExchangeRateWith,
  type ImportExchangeRateOptions,
} from './import-exchange-rate'
import {
  getMarketPrice as getMarketPriceWith,
  getPriceFreshness as getPriceFreshnessWith,
  getUsdBrlRate as getUsdBrlRateWith,
} from './read-prices'

/**
 * Ponto de composicao dos casos de uso de preco.
 *
 * Camada: application, a unica que pode falar com infrastructure.
 */

export function getMarketPrice(cardVariantId: bigint) {
  return getMarketPriceWith(prisma, cardVariantId)
}

export function getUsdBrlRate() {
  return getUsdBrlRateWith(prisma)
}

export function getPriceFreshness() {
  return getPriceFreshnessWith(prisma)
}

export function importPrices(options: ImportPricesOptions = {}) {
  return importPricesWith(prisma, new TcgCsvPriceProvider(), options)
}

export function importExchangeRate(options: ImportExchangeRateOptions = {}) {
  return importExchangeRateWith(prisma, new BcbPtaxProvider(), options)
}

export type { ImportPricesResult, ImportPricesOptions } from './import-prices'
export type {
  ImportExchangeRateResult,
  ImportExchangeRateOptions,
} from './import-exchange-rate'
export type { MarketPrice, BrlValue, PriceFreshness } from './read-prices'
