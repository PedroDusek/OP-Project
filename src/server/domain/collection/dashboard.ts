import { countsTowardPlayset, PLAYSET_SIZE } from './counting'

/**
 * O dashboard da coleção (decisão 098).
 *
 * Camada: domain. Puro: recebe o catálogo, o que a pessoa tem e os preços, e
 * devolve os números — sem banco e sem tela.
 *
 * ## As contas, definidas pelo dono do produto em 18/09
 *
 * - **Variantes por coleção**: quantas artes impressas naquela coleção a pessoa
 *   tem, sobre quantas existem. Duas artes da mesma carta na mesma coleção são
 *   duas variantes (regra 2.2).
 * - **Playsets por coleção**: quantas cartas daquela coleção têm 4 cópias,
 *   **somando as artes de qualquer coleção** — a carta é uma só (regra 2.1).
 *   Leader nunca conta playset.
 * - **Valor por coleção**: o que a pessoa tem de cada coleção. A mesma arte
 *   impressa em duas coleções vale nas duas — é ótica, não soma: o **valor
 *   total conta cada cópia uma vez só**.
 * - **Custo para completar**: uma cópia de cada variante que falta, pelo preço
 *   atual de cada uma. Variante sem preço fica de fora, e é contada.
 * - **Filtros**: coleção, raridade e cor. Eles recortam **o universo** — o que a
 *   pessoa tem e o que existe —, e todos os números obedecem.
 */

export interface DashboardVariant {
  id: string
  cardId: string
  cardCode: string
  cardName: string
  cardType: string
  rarity: string | null
  variantType: string
  colors: string[]
  imageUrl: string | null
  /** As coleções em que esta arte foi impressa. */
  setIds: string[]
}

export interface DashboardSet {
  id: string
  code: string
  displayCode: string
  displayName: string
  coverUrl: string | null
}

export interface DashboardFilters {
  setId?: string
  rarities?: string[]
  colors?: string[]
}

export interface DashboardInput {
  /** Na ordem de lançamento: é a ordem em que a tela mostra. */
  sets: DashboardSet[]
  variants: DashboardVariant[]
  /** Cópias por variante. Só o que a pessoa tem. */
  owned: ReadonlyMap<string, number>
  /** Preço atual em dólar, por variante. */
  prices: ReadonlyMap<string, number>
  filters: DashboardFilters
}

export interface SetProgress {
  set: DashboardSet
  variantsOwned: number
  variantsTotal: number
  playsetsClosed: number
  playsetsTotal: number
  valueUsd: number
  completeUsd: number
  /** Variantes que faltam e não têm preço: ficaram fora do custo. */
  missingWithoutPrice: number
}

export interface ValuableCard {
  variantId: string
  cardCode: string
  cardName: string
  variantType: string
  rarity: string | null
  imageUrl: string | null
  quantity: number
  unitUsd: number
}

export interface Slice {
  label: string
  copies: number
  valueUsd: number
}

export interface Dashboard {
  totalCopies: number
  totalValueUsd: number
  /** Cópias que a pessoa tem e não têm preço: ficaram fora do valor. */
  copiesWithoutPrice: number
  /** Uma cópia de cada variante que falta no recorte, cada uma contada uma vez. */
  completeUsd: number
  mostValuable: ValuableCard[]
  bySet: SetProgress[]
  byRarity: Slice[]
  byColor: Slice[]
  byType: Slice[]
}

/** Quantas cartas mais caras aparecem. Cinco cabem numa tela de celular sem rolar. */
export const MOST_VALUABLE_COUNT = 5

const dinheiro = (valor: number) => Math.round(valor * 100) / 100

function noRecorte(variant: DashboardVariant, filters: DashboardFilters): boolean {
  if (filters.setId && !variant.setIds.includes(filters.setId)) return false
  if (filters.rarities?.length && !(variant.rarity && filters.rarities.includes(variant.rarity))) return false
  if (filters.colors?.length && !variant.colors.some((color) => filters.colors!.includes(color))) return false
  return true
}

export function buildDashboard({ sets, variants, owned, prices, filters }: DashboardInput): Dashboard {
  // A carta é uma só (regra 2.1): as cópias de todas as artes, de qualquer
  // coleção e fora do filtro, somam para o playset.
  const copiasPorCarta = new Map<string, number>()
  for (const variant of variants) {
    const quantidade = owned.get(variant.id) ?? 0
    if (quantidade > 0) copiasPorCarta.set(variant.cardId, (copiasPorCarta.get(variant.cardId) ?? 0) + quantidade)
  }

  const recorte = variants.filter((variant) => noRecorte(variant, filters))

  let totalCopies = 0
  let totalValueUsd = 0
  let copiesWithoutPrice = 0
  let completeUsd = 0
  const possuidas: ValuableCard[] = []
  const porRaridade = new Map<string, Slice>()
  const porCor = new Map<string, Slice>()
  const porTipo = new Map<string, Slice>()

  const somar = (mapa: Map<string, Slice>, label: string, copies: number, valueUsd: number) => {
    const fatia = mapa.get(label) ?? { label, copies: 0, valueUsd: 0 }
    fatia.copies += copies
    fatia.valueUsd += valueUsd
    mapa.set(label, fatia)
  }

  for (const variant of recorte) {
    const quantidade = owned.get(variant.id) ?? 0
    const preco = prices.get(variant.id)

    if (quantidade === 0) {
      if (preco !== undefined) completeUsd += preco
      continue
    }

    const valor = preco === undefined ? 0 : preco * quantidade
    totalCopies += quantidade
    totalValueUsd += valor
    if (preco === undefined) copiesWithoutPrice += quantidade
    else {
      possuidas.push({
        variantId: variant.id,
        cardCode: variant.cardCode,
        cardName: variant.cardName,
        variantType: variant.variantType,
        rarity: variant.rarity,
        imageUrl: variant.imageUrl,
        quantity: quantidade,
        unitUsd: preco,
      })
    }

    somar(porRaridade, variant.rarity ?? 'Sem raridade', quantidade, valor)
    somar(porTipo, variant.cardType, quantidade, valor)
    // Carta de duas cores entra nas duas fatias: é como a pessoa procura.
    for (const cor of variant.colors) somar(porCor, cor, quantidade, valor)
  }

  const bySet: SetProgress[] = []
  for (const set of sets) {
    if (filters.setId && set.id !== filters.setId) continue
    const doSet = recorte.filter((variant) => variant.setIds.includes(set.id))
    if (doSet.length === 0) continue

    let variantsOwned = 0
    let valueUsd = 0
    let setCompleteUsd = 0
    let missingWithoutPrice = 0
    const cartas = new Set<string>()
    const cartasFechadas = new Set<string>()

    for (const variant of doSet) {
      const quantidade = owned.get(variant.id) ?? 0
      const preco = prices.get(variant.id)
      if (quantidade > 0) {
        variantsOwned++
        if (preco !== undefined) valueUsd += preco * quantidade
      } else if (preco !== undefined) {
        setCompleteUsd += preco
      } else {
        missingWithoutPrice++
      }

      if (countsTowardPlayset(variant.cardType)) {
        cartas.add(variant.cardId)
        if ((copiasPorCarta.get(variant.cardId) ?? 0) >= PLAYSET_SIZE) cartasFechadas.add(variant.cardId)
      }
    }

    // Só as coleções de que a pessoa tem alguma carta (pedido do dono do
    // produto) — a não ser que ela tenha filtrado uma de propósito.
    if (variantsOwned === 0 && !filters.setId) continue

    bySet.push({
      set,
      variantsOwned,
      variantsTotal: doSet.length,
      playsetsClosed: cartasFechadas.size,
      playsetsTotal: cartas.size,
      valueUsd: dinheiro(valueUsd),
      completeUsd: dinheiro(setCompleteUsd),
      missingWithoutPrice,
    })
  }

  const fatias = (mapa: Map<string, Slice>) =>
    [...mapa.values()]
      .map((fatia) => ({ ...fatia, valueUsd: dinheiro(fatia.valueUsd) }))
      .sort((a, b) => b.valueUsd - a.valueUsd || b.copies - a.copies)

  return {
    totalCopies,
    totalValueUsd: dinheiro(totalValueUsd),
    copiesWithoutPrice,
    completeUsd: dinheiro(completeUsd),
    mostValuable: possuidas
      .sort((a, b) => b.unitUsd - a.unitUsd || a.cardCode.localeCompare(b.cardCode))
      .slice(0, MOST_VALUABLE_COUNT),
    bySet,
    byRarity: fatias(porRaridade),
    byColor: fatias(porCor),
    byType: fatias(porTipo),
  }
}
