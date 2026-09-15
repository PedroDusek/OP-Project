/**
 * O estado do formulário de uma arte na conferência da Liga.
 *
 * Vive fora de `actions.ts` porque um arquivo `'use server'` só pode exportar
 * função assíncrona (armadilha 11).
 */
export type LigaCardState =
  | { status: 'idle' }
  | { status: 'saved'; url: string | null }
  | { status: 'cleared' }
  | { status: 'confirmed' }
  | { status: 'error'; message: string }

export const LIGA_CARD_IDLE: LigaCardState = { status: 'idle' }

/**
 * O que o botão pediu: gravar o endereço, dizer que não existe, desfazer, ou —
 * nas revisões — confirmar que a `(Reprint)` estava certa, ou que a Liga não
 * distingue as artes repetidas.
 */
export type LigaCardIntent = 'gravar' | 'sem-pagina' | 'limpar' | 'confirmar-reprint' | 'confirmar-mesma-identidade'
