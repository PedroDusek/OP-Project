/**
 * O estado do formulário de uma carta na tela de mapeamento.
 *
 * Vive fora de `actions.ts` porque um arquivo `'use server'` só pode exportar
 * função assíncrona (armadilha 11).
 */
export type MappingState =
  | { status: 'idle' }
  | { status: 'saved'; recorded: number }
  | { status: 'error'; message: string }

export const MAPPING_IDLE: MappingState = { status: 'idle' }

/** O prefixo do campo de cada arte: `arte:OP01-016_p3`. */
export const ART_FIELD_PREFIX = 'arte:'

/**
 * O valor de "a fonte não tem esta arte".
 *
 * Um valor de sentinela, e não o campo vazio: vazio é "ainda não escolhi", e as
 * duas coisas precisam chegar diferentes ao servidor — uma grava `null`, a outra
 * não grava nada.
 */
export const NO_PRODUCT = 'nenhum'
