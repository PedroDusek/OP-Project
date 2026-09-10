import type { OriginQuestion } from '@/server/application/trades'

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

/**
 * O estado de marcar que as cartas trocaram de mao.
 *
 * Tem um estado a mais que os outros, e ele nao cabia no `TradeActionState`:
 * quando as copias de uma carta estao em mais de um local de troca, a regra 4.6
 * manda perguntar de onde elas saem, e a resposta do servidor traz a pergunta
 * inteira — carta, quantidade e locais — para a tela desenhar.
 *
 * `completed` e separado de `done` de proposito. Marcar sozinho e marcar sendo o
 * segundo sao a mesma acao com desfechos diferentes: no primeiro caso falta o
 * outro, no segundo a troca acabou de acontecer e a colecao mudou.
 */
export type ExchangeState =
  | { status: 'idle' }
  | { status: 'marked' }
  | { status: 'completed' }
  | { status: 'origin'; message: string; cards: OriginQuestion[] }
  | { status: 'error'; message: string }

export const EXCHANGE_IDLE: ExchangeState = { status: 'idle' }
