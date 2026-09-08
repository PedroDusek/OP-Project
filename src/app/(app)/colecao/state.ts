import type { AllocationSnapshot } from '@/server/application/collection'

/**
 * O estado do formulario de quantidade.
 *
 * Vive fora de `actions.ts` porque um arquivo `'use server'` so pode exportar
 * funcao assincrona — exportar um tipo ou uma constante de la passa no build e
 * quebra no primeiro envio.
 */
export type QuantityState =
  | { status: 'idle' }
  | { status: 'saved'; quantity: number; removed: boolean }
  | { status: 'error'; message: string }
  /**
   * Decisao 007: reduzir abaixo do que esta alocado devolve as alocacoes atuais
   * para a pessoa escolher de onde as copias saem. A tela de resolucao depende
   * das telas de armazenamento; ate la, o conflito e mostrado por extenso.
   */
  | {
      status: 'conflict'
      message: string
      currentQuantity: number
      requestedQuantity: number
      allocations: AllocationSnapshot[]
    }

export const QUANTITY_IDLE: QuantityState = { status: 'idle' }

/**
 * O estado do formulario de want.
 *
 * Mais simples que o da quantidade possuida, e de proposito: um want nao
 * sustenta invariante nenhuma, entao nao ha conflito a resolver — so o que foi
 * gravado.
 */
export type WantState =
  | { status: 'idle' }
  | { status: 'saved'; quantity: number; removed: boolean }
  | { status: 'error'; message: string }

export const WANT_IDLE: WantState = { status: 'idle' }
