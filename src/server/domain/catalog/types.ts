/**
 * Formato interno normalizado do catalogo.
 *
 * Camada: domain. Puro, sem I/O. Nenhum provedor externo aparece aqui — cada
 * implementacao de CatalogProvider traduz o proprio payload para estes tipos,
 * de modo que trocar de fonte nao alcanca o resto do sistema.
 */

export const CARD_TYPES = ['Leader', 'Character', 'Event', 'Stage'] as const
export type CardType = (typeof CARD_TYPES)[number]

export interface SetDTO {
  /** Codigo do set na fonte, como "OP-17". Unico. */
  code: string
  name: string
}

export interface CardDTO {
  /** Codigo da carta, como "OP17-001". Unico e imutavel. */
  code: string
  name: string
  type: CardType
  cost: number | null
  power: number | null
  life: number | null
  counter: number | null
  hasTrigger: boolean
  blockIcon: string | null
  colors: string[]
  traits: string[]
  attributes: string[]
  mechanics: string[]
}

export interface VariantDTO {
  /** Identificador externo por arte, decisao 019. Ex.: "OP17-001_p1". */
  sourceId: string
  /** Codigo da carta a que esta variante pertence. */
  cardCode: string
  variantType: string
  rarity: string | null
  imageUrl: string | null
  /** Codigos dos sets em que esta variante foi impressa. */
  printedInSetCodes: string[]
}

export interface CatalogPage {
  sets: SetDTO[]
  cards: CardDTO[]
  variants: VariantDTO[]
  /** Entradas descartadas, com o motivo. Nunca adivinhadas. */
  rejected: RejectedEntry[]
}

export interface RejectedEntry {
  sourceId: string | null
  reason: string
}

/**
 * Vocabulario de mecanicas aceito na importacao.
 *
 * Esta lista existe porque o texto das cartas usa colchetes para varias coisas
 * diferentes: mecanicas de verdade, mas tambem nomes de personagem
 * ("[Shanks]", "[Edward.Newgate]") e marcadores de custo ("[DON!! x2]").
 * Extrair todo colchete criaria mecanicas chamadas "Fossa", que e exatamente o
 * tipo de classificacao inventada que a especificacao proibe.
 *
 * O conteudo e o que a especificacao lista. Ampliar exige aprovacao, porque
 * define o que passa a ser filtravel no catalogo.
 */
export const KNOWN_MECHANICS = [
  'Rush',
  'Blocker',
  'On Play',
  'When Attacking',
  'Activate: Main',
  'Once Per Turn',
] as const

export interface CatalogProvider {
  readonly name: string
  /** Lista os identificadores de serie disponiveis na fonte. */
  listSeriesIds(): Promise<string[]>
  /** Busca e normaliza uma serie inteira. */
  fetchSeries(seriesId: string): Promise<CatalogPage>
}
