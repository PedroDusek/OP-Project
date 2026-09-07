/**
 * Locais de armazenamento: tipo, finalidade e os limites de texto.
 *
 * Camada: domain. Puro, sem I/O.
 *
 * A regra de `business-rules.md` 3.1 é curta e fácil de escrever errado em três
 * lugares diferentes — formulário, caso de uso e banco. O banco já a impõe com
 * um `CHECK`; aqui ela existe para que a interface não chegue a oferecer uma
 * combinação que o banco vai recusar.
 */

export const STORAGE_TYPES = ['BINDER', 'BOX', 'DECK'] as const
export type StorageType = (typeof STORAGE_TYPES)[number]

export const STORAGE_PURPOSES = ['COLLECTION', 'TRADE'] as const
export type StoragePurpose = (typeof STORAGE_PURPOSES)[number]

export const STORAGE_TYPE_LABEL: Record<StorageType, string> = {
  BINDER: 'Binder',
  BOX: 'Caixa',
  DECK: 'Deck',
}

/** Para as abas da tela 21: "Binders (2)". */
export const STORAGE_TYPE_PLURAL: Record<StorageType, string> = {
  BINDER: 'Binders',
  BOX: 'Caixas',
  DECK: 'Decks',
}

export const STORAGE_PURPOSE_LABEL: Record<StoragePurpose, string> = {
  COLLECTION: 'Coleção',
  TRADE: 'Troca',
}

/** `VARCHAR(100)` e `VARCHAR(500)` no banco. */
export const NAME_MAX_LENGTH = 100
export const DESCRIPTION_MAX_LENGTH = 500

export function isStorageType(value: unknown): value is StorageType {
  return typeof value === 'string' && (STORAGE_TYPES as readonly string[]).includes(value)
}

export function isStoragePurpose(value: unknown): value is StoragePurpose {
  return typeof value === 'string' && (STORAGE_PURPOSES as readonly string[]).includes(value)
}

/**
 * Deck nunca tem finalidade; binder e caixa sempre têm.
 *
 * Uma caixa de troca é válida — é a regra, e não uma exceção
 * (`business-rules.md` 3.1).
 */
export function requiresPurpose(type: StorageType): boolean {
  return type !== 'DECK'
}

export function isPurposeAllowed(type: StorageType, purpose: StoragePurpose | null): boolean {
  return requiresPurpose(type) ? purpose !== null : purpose === null
}

/**
 * A finalidade que de fato será gravada.
 *
 * Trocar de Binder para Deck no formulário deixa "Coleção" marcado atrás do
 * campo desabilitado; mandar isso ao banco quebraria o `CHECK`. Descartar aqui
 * é mais honesto que confiar que toda tela lembre de limpar.
 */
export function normalizePurpose(
  type: StorageType,
  purpose: StoragePurpose | null,
): StoragePurpose | null {
  return requiresPurpose(type) ? purpose : null
}

/** "Binder • Coleção", "Deck" — o subtítulo das telas 21 e 22. */
export function describeLocation(type: StorageType, purpose: StoragePurpose | null): string {
  const label = STORAGE_TYPE_LABEL[type]
  const normalized = normalizePurpose(type, purpose)
  return normalized ? `${label} • ${STORAGE_PURPOSE_LABEL[normalized]}` : label
}

/**
 * Um local de troca é o que abastece o Trade Binder (`business-rules.md` 4.2 e
 * 5). Deck nunca é: as cópias estão num deck montado, não à disposição.
 */
export function holdsTradeStock(type: StorageType, purpose: StoragePurpose | null): boolean {
  return normalizePurpose(type, purpose) === 'TRADE'
}
