/**
 * O estado dos formularios de troca.
 *
 * Vive fora de `actions.ts` porque um arquivo `'use server'` so pode exportar
 * funcao assincrona: exportar uma constante de la **passa no build** e quebra no
 * primeiro envio.
 */

export type StartTradeState =
  | { status: 'idle' }
  | { status: 'started'; tradeId: string; inviteToken: string }
  | { status: 'error'; message: string }

export const START_TRADE_IDLE: StartTradeState = { status: 'idle' }

/**
 * O estado de qualquer mexida numa troca aberta.
 *
 * Um estado so para oferta, confirmacao e cancelamento: as tres devolvem a
 * mesma coisa util — deu certo ou nao —, e a tela inteira e recarregada pelo
 * `revalidatePath` de qualquer jeito. Tres estados diferentes seriam tres
 * formas de dizer o mesmo.
 */
export type TradeActionState =
  | { status: 'idle' }
  | { status: 'done' }
  | { status: 'error'; message: string }

export const TRADE_ACTION_IDLE: TradeActionState = { status: 'idle' }
