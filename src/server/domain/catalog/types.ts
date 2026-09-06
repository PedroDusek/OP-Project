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
  /**
   * Produtos citados pela fonte sem codigo entre colchetes, como
   * "Tournament Pack Vol.4". Nao viram set porque `sets.code` e obrigatorio e a
   * fonte nao fornece um; derivar um codigo seria inventar identidade.
   *
   * Ficam listados aqui em vez de sumirem em silencio: as variantes desses
   * produtos entram no catalogo sem set, e isso precisa ser visivel no relatorio
   * de importacao. Decisao pendente.
   */
  unmappedSetNames: string[]
}

export interface RejectedEntry {
  sourceId: string | null
  reason: string
}

/**
 * Vocabulario de mecanicas aceito na importacao.
 *
 * Esta lista existe porque o texto das cartas usa colchetes para varias coisas
 * diferentes. O levantamento sobre o catalogo completo achou 217 termos
 * distintos entre colchetes, e 195 deles batem exatamente com nomes de carta
 * do proprio catalogo: "[Sanji]", "[Nami]", "[Upper Yard]". Aceitar todo
 * colchete criaria 195 mecanicas que sao nomes de personagem, exatamente o tipo
 * de classificacao inventada que a especificacao proibe.
 *
 * Conteudo aprovado: as seis que a especificacao nomeia, mais os quatro
 * gatilhos de efeito da decisao 022. Ampliar de novo exige aprovacao, porque
 * define o que passa a ser filtravel no catalogo.
 */
export const KNOWN_MECHANICS = [
  // Especificacao, secao 25.
  'Rush',
  'Blocker',
  'On Play',
  'When Attacking',
  'Activate: Main',
  'Once Per Turn',
  // Gatilhos de efeito, decisao 022. Dizem quando o efeito dispara, na mesma
  // natureza de "On Play" e "When Attacking".
  'On K.O.',
  'On Block',
  "On Your Opponent's Attack",
  'End of Your Turn',
] as const

/**
 * Termos da fonte que sao a mesma mecanica escrita de outro jeito.
 *
 * "Rush: Character" e Rush com alvo restrito, nao uma mecanica separada:
 * normalizar mantem as 11 cartas que a concedem visiveis para quem filtra por
 * Rush, que e a intencao de quem busca (decisao 022).
 */
export const MECHANIC_ALIASES: Readonly<Record<string, string>> = {
  'Rush: Character': 'Rush',
}

export interface CatalogProvider {
  readonly name: string
  /** Lista os identificadores de serie disponiveis na fonte. */
  listSeriesIds(): Promise<string[]>
  /** Busca e normaliza uma serie inteira. */
  fetchSeries(seriesId: string): Promise<CatalogPage>
}
