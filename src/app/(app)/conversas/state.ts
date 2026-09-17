/**
 * O estado do envio de mensagem.
 *
 * Vive fora de `actions.ts` porque um arquivo `'use server'` só pode exportar
 * função assíncrona (armadilha 11).
 */
export type SendMessageState =
  | { status: 'idle' }
  | { status: 'sent'; at: number }
  | { status: 'error'; message: string }

export const SEND_MESSAGE_IDLE: SendMessageState = { status: 'idle' }

export type StartConversationState = { status: 'idle' } | { status: 'error'; message: string }

export const START_CONVERSATION_IDLE: StartConversationState = { status: 'idle' }
